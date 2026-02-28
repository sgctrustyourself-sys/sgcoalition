import { ethers } from 'ethers';

const SGCOIN_V1_CONTRACT_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';
const SGCOIN_V2_CONTRACT_ADDRESS = '0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e';
const SGCOIN_BURN_ADDRESS = '0x20756b2667D575Ddde2383f3841D2CD855D5fb6d';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const POLYGON_RPC_URL = 'https://polygon-rpc.com';

const RPCs = [
    'https://polygon-bor-rpc.publicnode.com',
    'https://1rpc.io/matic',
    'https://polygon-rpc.com'
];

async function audit() {
    console.log('--- Blockchain Audit ---');
    let provider;
    for (const url of RPCs) {
        try {
            console.log(`Trying RPC: ${url}`);
            provider = new ethers.JsonRpcProvider(url);
            await provider.getNetwork();
            break;
        } catch (e) {
            console.warn(`RPC ${url} failed`);
        }
    }

    const v1 = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], provider);
    const v2 = new ethers.Contract(SGCOIN_V2_CONTRACT_ADDRESS, ['function totalSupply() view returns (uint256)'], provider);

    try {
        const [migBal, deadBal, v1Decimals, v2TotalSupply] = await Promise.all([
            v1.balanceOf(SGCOIN_BURN_ADDRESS),
            v1.balanceOf(DEAD_ADDRESS),
            v1.decimals(),
            v2.totalSupply()
        ]);
        console.log('V1 Decimals:', v1Decimals);
        const total = migBal + deadBal;
        console.log('Total Burned (Actual Formatted):', ethers.formatUnits(total, v1Decimals));
        console.log('V2 Total Supply:', ethers.formatUnits(v2TotalSupply, 18));
    } catch (e) {
        console.error('V1 Audit Failed:', e.message);
    }

    console.log('\n--- DexScreener Audit ---');
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SGCOIN_V2_CONTRACT_ADDRESS}`);
        const data = await res.json();
        if (data.pairs) {
            console.log(`Found ${data.pairs.length} pairs`);
            data.pairs.forEach((pair, idx) => {
                console.log(`Pair ${idx + 1}: ${pair.dexId} | ${pair.baseToken.symbol}/${pair.quoteToken.symbol}`);
                console.log(`  Price: ${pair.priceUsd}`);
                console.log(`  Liquidity: $${pair.liquidity.usd}`);
                console.log(`  Volume: ${pair.volume.h24}`);
                console.log(`  URL: ${pair.url}`);
            });
        } else {
            console.log('No pairs found for V2 token on DexScreener');
        }
    } catch (e) {
        console.error('DexScreener Audit Failed:', e.message);
    }
}

audit();
