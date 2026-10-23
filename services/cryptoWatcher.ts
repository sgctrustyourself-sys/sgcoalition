// services/cryptoWatcher.ts
//
// Read-only on-chain verifier for direct USDC-on-Polygon checkout payments.
//
// Trust model: an RPC/explorer endpoint only READS the chain — it never
// holds funds. Customer wallets pay the merchant address directly; this
// module checks that a matching USDC Transfer landed. Private keys never
// touch the server; only the public receiving address is stored (same
// trust model as publishing it on a poster).
//
// Asset scope is USDC on Polygon ONLY. Any-coin conversion is deliberately
// out of scope: a converter is a counterparty that transiently holds and
// swaps the funds, which violates the no-middleman rule.
//
// Chain access mirrors the existing client reader (utils/polygonScanApi.ts —
// Etherscan V2, chainid 137) but is server-side: the API key comes from
// server env, and every failure mode FAILS CLOSED (throws — never mock
// data). A verification outage degrades to the manual email flow, never to
// a false "paid".

// Native USDC on Polygon (6 decimals). The bridged variant
// (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174) is NOT accepted —
// totals are quoted against native USDC only.
export const NATIVE_USDC_POLYGON = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
export const POLYGON_CHAIN_ID = 137;
export const USDC_DECIMALS = 6;

// Merchant-address fallback. Mirrors FOUNDER_WALLET_ADDRESS (constants.ts)
// and WALLET_ADDRESS (pages/Checkout.tsx) — the live payment_settings row
// carries the authoritative address once the crypto-verify migration lands;
// until then (or when the row is unreadable) all three agree on this.
export const FOUNDER_WALLET_FALLBACK = '0x0F4A0466C2a1d3FA6Ed55a20994617F0533fbf74';

export const DEFAULT_CRYPTO_WINDOW_HOURS = 24;
export const MIN_CRYPTO_WINDOW_HOURS = 1;
export const MAX_CRYPTO_WINDOW_HOURS = 72;

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const ETHERSCAN_V2_API = 'https://api.etherscan.io/v2/api';

// Server-side explorer key. POLYGONSCAN_API_KEY / ETHERSCAN_API_KEY are the
// configured server secrets; VITE_POLYGONSCAN_API_KEY is accepted as a last
// resort (it is the same public explorer key the client reader already
// uses). Empty means the verifier is not configured — callers must fail
// closed, never fall back to mock data.
export function explorerApiKey(): string {
    return (
        process.env.POLYGONSCAN_API_KEY ||
        process.env.ETHERSCAN_API_KEY ||
        process.env.VITE_POLYGONSCAN_API_KEY ||
        ''
    ).trim();
}

export function isValidTxHash(value: unknown): boolean {
    return typeof value === 'string' && TX_HASH_RE.test(value.trim());
}

export function isValidAddress(value: unknown): boolean {
    return typeof value === 'string' && ADDRESS_RE.test(value.trim());
}

// Dollars (order total, server-priced) -> USDC base units. Integer math
// only — USDC has 6 decimals and float comparison is how a 1-unit underpay
// becomes a false confirm.
export function usdcDollarsToBaseUnits(dollars: unknown): bigint {
    const n = Number(dollars);
    if (!Number.isFinite(n) || n < 0) throw new Error('Invalid USDC amount.');
    return BigInt(Math.round(n * 10 ** USDC_DECIMALS));
}

export function baseUnitsToUsdc(units: bigint | string): string {
    const v = typeof units === 'bigint' ? units : BigInt(units);
    const negative = v < BigInt(0);
    const abs = negative ? -v : v;
    const whole = abs / BigInt(10 ** USDC_DECIMALS);
    const frac = (abs % BigInt(10 ** USDC_DECIMALS)).toString().padStart(USDC_DECIMALS, '0');
    return (negative ? '-' : '') + whole.toString() + '.' + frac;
}

export interface UsdcTransfer {
    hash: string;
    from: string;
    to: string;
    contractAddress: string;
    // Raw base-unit integer string, exactly as the explorer returns it.
    valueBaseUnits: string;
    timestampMs: number;
    blockNumber: number;
}

export interface TransferExpectation {
    merchantAddress: string;
    usdcContract: string;
    expectedBaseUnits: bigint;
    // Inclusive bounds. windowStartMs is the order creation time;
    // windowEndMs is creation + the configured payment window.
    windowStartMs: number;
    windowEndMs: number;
}

export type TransferVerdict = 'confirmed' | 'underpaid' | 'no_match';

// Pure match rule — the unit under test. Every comparison is server-side
// from chain data; the customer-submitted hash is only a lookup key.
export function evaluateUsdcTransfer(
    tx: Pick<UsdcTransfer, 'to' | 'contractAddress' | 'valueBaseUnits' | 'timestampMs'>,
    expectation: TransferExpectation,
): { verdict: TransferVerdict; reason: string } {
    if (String(tx.contractAddress || '').toLowerCase() !== expectation.usdcContract.toLowerCase()) {
        return { verdict: 'no_match', reason: 'unexpected_token' };
    }
    if (String(tx.to || '').toLowerCase() !== expectation.merchantAddress.toLowerCase()) {
        return { verdict: 'no_match', reason: 'not_to_merchant' };
    }
    const ts = Number(tx.timestampMs);
    if (!Number.isFinite(ts) || ts < expectation.windowStartMs || ts > expectation.windowEndMs) {
        return { verdict: 'no_match', reason: 'outside_window' };
    }
    let value: bigint;
    try {
        value = BigInt(String(tx.valueBaseUnits));
    } catch {
        return { verdict: 'no_match', reason: 'unparseable_value' };
    }
    if (value < expectation.expectedBaseUnits) {
        return { verdict: 'underpaid', reason: 'underpaid' };
    }
    // Overpays confirm — the merchant keeps the difference, same as cash.
    return { verdict: 'confirmed', reason: 'match' };
}

export interface TransferSearch {
    merchantAddress: string;
    usdcContract?: string;
    apiKey?: string;
    txHash?: string;
    // Lower bound for the paging stop condition (order creation time).
    // Pages stop once transfers are older than this.
    windowStartMs?: number;
    maxPages?: number;
    fetchImpl?: typeof fetch;
}

function parseTransfer(raw: Record<string, any>): UsdcTransfer | null {
    try {
        const hash = String(raw.hash || '');
        const from = String(raw.from || '');
        const to = String(raw.to || '');
        const contractAddress = String(raw.contractAddress || '');
        const valueBaseUnits = String(raw.value || '');
        const timestampMs = Number(raw.timeStamp) * 1000;
        const blockNumber = Number(raw.blockNumber);
        if (!isValidTxHash(hash) || !timestampMs || !Number.isFinite(blockNumber)) return null;
        BigInt(valueBaseUnits);
        return { hash, from, to, contractAddress, valueBaseUnits, timestampMs, blockNumber };
    } catch {
        return null;
    }
}

// Lists recent USDC transfers TO the merchant address (newest first).
// Throws on every failure — missing key, network error, explorer error —
// so callers degrade to manual review instead of guessing.
export async function fetchUsdcTransfersTo(search: TransferSearch): Promise<UsdcTransfer[]> {
    const merchantAddress = String(search.merchantAddress || '').trim();
    if (!isValidAddress(merchantAddress)) throw new Error('Invalid merchant address.');
    const usdcContract = (search.usdcContract || NATIVE_USDC_POLYGON).trim();
    const apiKey = (search.apiKey ?? explorerApiKey()).trim();
    if (!apiKey) throw new Error('Chain verifier is not configured.');
    const fetchImpl = search.fetchImpl || fetch;
    const windowStartMs = Number(search.windowStartMs) || 0;
    const maxPages = Math.max(1, Math.min(10, Number(search.maxPages) || 5));
    const pageSize = 100;

    const found: UsdcTransfer[] = [];
    for (let page = 1; page <= maxPages; page++) {
        const url =
            `${ETHERSCAN_V2_API}?chainid=${POLYGON_CHAIN_ID}` +
            `&module=account&action=tokentx` +
            `&contractaddress=${encodeURIComponent(usdcContract)}` +
            `&address=${encodeURIComponent(merchantAddress)}` +
            `&page=${page}&offset=${pageSize}&sort=desc&apikey=${encodeURIComponent(apiKey)}`;
        let response: Response;
        try {
            response = await fetchImpl(url);
        } catch (e: any) {
            throw new Error('Chain lookup failed: ' + (e?.message || 'network error'));
        }
        if (!response.ok) throw new Error('Chain lookup failed: HTTP ' + response.status);
        const data: any = await response.json().catch(() => null);
        const result = data?.result;
        if (!Array.isArray(result)) {
            // Etherscan answers status '0' + 'No transactions found' for an
            // empty address — that is a valid empty page, not an error.
            // Anything else non-array is an explorer failure: fail closed.
            const message = String(data?.message || '');
            if (/no transactions found/i.test(message)) return found;
            throw new Error('Chain lookup failed: ' + (message || 'unexpected explorer response'));
        }
        for (const raw of result) {
            const tx = parseTransfer(raw);
            if (tx) found.push(tx);
        }
        // Stop paging once transfers predate the order — older pages can
        // only be older. A final partial page also ends the walk.
        const oldest = found.length ? found[found.length - 1].timestampMs : 0;
        if (result.length < pageSize) break;
        if (windowStartMs > 0 && oldest > 0 && oldest < windowStartMs) break;
    }
    return found;
}

// Finds one transfer by hash within the merchant's recent USDC receipts.
// Returns null when the hash is not (yet) among them — unmined, wrong
// hash, or outside the paged window — which the caller reports as
// "awaiting", never as a verdict.
export async function findUsdcTransferByHash(search: TransferSearch & { txHash: string }): Promise<UsdcTransfer | null> {
    const wanted = String(search.txHash || '').trim().toLowerCase();
    if (!isValidTxHash(wanted)) throw new Error('Invalid transaction hash.');
    const transfers = await fetchUsdcTransfersTo(search);
    return transfers.find(t => t.hash.toLowerCase() === wanted) || null;
}

// ---------------------------------------------------------------------------
// Merchant config (payment_settings singleton row)
// ---------------------------------------------------------------------------

export interface MerchantCryptoConfig {
    // Effective receiving address: the row value when valid, otherwise the
    // founder fallback (same address the checkout hardcodes today).
    merchantAddress: string;
    merchantAddressConfigured: boolean;
    windowHours: number;
    usdcContract: string;
}

// Minimal structural DB type — the handler passes the service-role client;
// tests pass a stub. select('*') deliberately (not the explicit column
// list): the row predates the crypto-verify migration in some
// environments, and an explicit select of a missing column turns the whole
// read into an error. Unknown columns simply read as undefined here and
// fall back to the safe defaults below.
export interface SettingsRowReader {
    from: (table: string) => any;
}

export async function loadMerchantCryptoConfig(db: SettingsRowReader): Promise<MerchantCryptoConfig> {
    const fallback: MerchantCryptoConfig = {
        merchantAddress: FOUNDER_WALLET_FALLBACK,
        merchantAddressConfigured: false,
        windowHours: DEFAULT_CRYPTO_WINDOW_HOURS,
        usdcContract: NATIVE_USDC_POLYGON,
    };
    try {
        const { data, error } = await db.from('payment_settings').select('*').eq('id', 1).maybeSingle();
        if (error || !data) return fallback;
        const rawAddr = String((data as Record<string, unknown>).crypto_merchant_address || '').trim();
        const rawWindow = Number((data as Record<string, unknown>).crypto_window_hours);
        const rawUsdc = String((data as Record<string, unknown>).crypto_usdc_contract || '').trim();
        return {
            merchantAddress: isValidAddress(rawAddr) ? rawAddr : FOUNDER_WALLET_FALLBACK,
            merchantAddressConfigured: isValidAddress(rawAddr),
            windowHours: Number.isInteger(rawWindow)
                ? Math.min(MAX_CRYPTO_WINDOW_HOURS, Math.max(MIN_CRYPTO_WINDOW_HOURS, rawWindow))
                : DEFAULT_CRYPTO_WINDOW_HOURS,
            usdcContract: isValidAddress(rawUsdc) ? rawUsdc : NATIVE_USDC_POLYGON,
        };
    } catch {
        return fallback;
    }
}
