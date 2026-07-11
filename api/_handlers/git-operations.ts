// Vercel handler for /api/git-operations. Mirrors server.cjs (Express) for
// local dev parity, with one important runtime constraint:
//
//   THE GIT BINARY IS NOT AVAILABLE IN THE VERCEL SERVERLESS RUNTIME.
//   THE FILESYSTEM IS READ-ONLY (only /tmp is writable, and it does not
//   persist across invocations or affect the deployed repo).
//
// So on Vercel every action returns 501 with a structured payload
// (action + devOnly:true + hint) so the client still gets a useful
// error instead of a 404 or a confusing 500. On a long-running Node
// deployment (self-hosted, non-Vercel), the handler falls through to
// services/gitService.ts and exercises the same actions as server.cjs.
//
// Sync-constants is the most commonly invoked action from the admin
// panel. Its implementation mirrors server.cjs so behavior is identical
// when this handler runs in a writable environment.

import { createClient } from '@supabase/supabase-js';

function setCorsHeaders(req: any, res: any) {
    const configuredOrigin = process.env.VITE_APP_URL || 'https://sgcoalition.xyz';
    const allowedOrigins = new Set([
        configuredOrigin,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
    ]);
    const requestOrigin = req.headers?.origin;
    const responseOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : configuredOrigin;

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// VERCEL=1 is set on both production and preview deployments by Vercel.
// A long-running self-hosted Node deployment won't set it.
function isVercelRuntime(): boolean {
    return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
}

function parseBody(req: any): any {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch {
            throw Object.assign(new Error('Invalid JSON request body.'), { status: 400 });
        }
    }
    return req.body;
}

function getSupabaseAdmin() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw Object.assign(new Error('Supabase admin service is not configured.'), { status: 503 });
    }
    return createClient(supabaseUrl, serviceRoleKey);
}

// Mirror of server.cjs sync-constants. Lazy-imports fs/path/gitService so
// cold start on Vercel skips the git binary until needed (and never is,
// because the devOnly path returns first).
async function syncConstantsHandler(req: any) {
    const supabase = getSupabaseAdmin();
    const { data: dbProducts, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
    if (fetchError) throw Object.assign(new Error(fetchError.message), { status: 500 });
    if (!dbProducts) throw Object.assign(new Error('No products returned from Supabase'), { status: 500 });

    // Map to Product[] shape — identical to scripts/syncProducts.ts and
    // server.cjs so a sync run from either side produces the same diff.
    const mappedProducts = dbProducts.map((p: any) => ({
        id: p.id,
        name: (p.name || '').trim(),
        price: p.price,
        images: p.images || [],
        description: (p.description || '').trim(),
        category: (() => {
            const c = (p.category || 'apparel').toLowerCase().trim();
            return c === 'accessories' ? 'accessory' : c;
        })(),
        isFeatured: !!p.is_featured,
        isLimitedEdition: p.is_limited_edition ?? false,
        sizes: p.sizes || [],
        sizeInventory: p.size_inventory || {},
        nft: p.nft_metadata || null,
        archived: !!p.archived,
        archivedAt: p.archived_at || null,
        releasedAt: p.released_at || null,
        soldAt: p.sold_at || null,
    }));

    const replacement = `export const INITIAL_PRODUCTS: Product[] = ${JSON.stringify(mappedProducts, null, 2)};`;
    const replaceRegex = /export const INITIAL_PRODUCTS: Product\[\] = \[[\s\S]*?\];/;
    const commitMessage = (req.body?.message) || 'Sync products from Supabase';

    // Route through the GitHub Contents API when (a) we're on Vercel (no git
    // binary, read-only FS) or (b) GITHUB_TOKEN is set anywhere. The shared
    // githubSync.cjs module handles auth, noChanges detection, and the PUT.
    const useGithub = isVercelRuntime() || Boolean(process.env.GITHUB_TOKEN);

    if (useGithub) {
        const { syncFileOnGitHub } = await import('../../services/githubSync.cjs');
        return await syncFileOnGitHub(
            'constants.ts',
            (content: string) => content.replace(replaceRegex, replacement),
            commitMessage
        );
    }

    // Local dev without GITHUB_TOKEN: use the fs + git workflow which is
    // faster and gives the operator a real git history locally.
    const fs = await import('fs');
    const pathMod = await import('path');
    const gitService = await import('../../services/gitService.js');

    const constantsPath = pathMod.resolve(process.cwd(), 'constants.ts');
    const beforeContent = fs.readFileSync(constantsPath, 'utf8');
    const afterContent = beforeContent.replace(replaceRegex, replacement);

    if (afterContent === beforeContent) {
        const recent = await gitService.getCommitHistory(1);
        return { noChanges: true, hash: recent[0]?.hash };
    }

    fs.writeFileSync(constantsPath, afterContent, 'utf8');
    const hash = await gitService.createCommit(commitMessage, 'Coalition Admin <admin@coalition.local>');
    return { success: true, hash };
}

function getAction(req: any): string | undefined {
    const q = req.query?.action;
    if (typeof q === 'string') return q;
    if (Array.isArray(q) && typeof q[0] === 'string') return q[0];
    return undefined;
}

export default async function handler(req: any, res: any) {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const action = getAction(req);
    if (!action) {
        res.status(400).json({ error: 'Missing required query parameter: action' });
        return;
    }

    // Vercel: only generic git ops (commit / log / branches / etc.) are
    // dev-only. sync-constants routes through the GitHub Contents API and
    // actually works on production — it just needs GITHUB_TOKEN / REPO_OWNER
    // / REPO_NAME env vars.
    if (isVercelRuntime() && action !== 'sync-constants') {
        const hint = 'Run `npm run dev` locally so Vite proxies /api/* to Express on localhost:4242.';
        res.status(501).json({
            error: `Action "${action}" requires the local dev server. ${hint}`,
            action,
            devOnly: true,
        });
        return;
    }

    try {
        // Skip the local git-repo check for sync-constants on Vercel since
        // there is no git binary there; the GitHub API does the auth check
        // upstream.
        if (action !== 'sync-constants') {
            const { isGitRepository } = await import('../../services/gitService.js');
            if (!(await isGitRepository())) {
                res.status(500).json({ error: 'Git repository not initialized' });
                return;
            }
        }

        const body = parseBody(req);

        switch (action) {
            case 'commit': {
                if (req.method !== 'POST') {
                    res.status(405).json({ error: 'Method not allowed' });
                    return;
                }
                const { message, author } = body;
                if (!message) {
                    res.status(400).json({ error: 'Commit message is required' });
                    return;
                }
                const { createCommit } = await import('../../services/gitService.js');
                const hash = await createCommit(message, author);
                res.status(200).json({ success: true, hash });
                return;
            }

            case 'log': {
                const limit = parseInt(String(req.query?.limit || ''), 10) || 50;
                const { getCommitHistory } = await import('../../services/gitService.js');
                const commits = await getCommitHistory(limit);
                res.status(200).json({ commits });
                return;
            }

            case 'branches': {
                const { getBranches, getCurrentBranch } = await import('../../services/gitService.js');
                const branches = await getBranches();
                const currentBranch = await getCurrentBranch();
                res.status(200).json({ branches, currentBranch });
                return;
            }

            case 'checkout': {
                if (req.method !== 'POST') {
                    res.status(405).json({ error: 'Method not allowed' });
                    return;
                }
                const { branch } = body;
                if (!branch) {
                    res.status(400).json({ error: 'Branch name is required' });
                    return;
                }
                const { switchBranch } = await import('../../services/gitService.js');
                await switchBranch(branch);
                res.status(200).json({ success: true, branch });
                return;
            }

            case 'reset': {
                if (req.method !== 'POST') {
                    res.status(405).json({ error: 'Method not allowed' });
                    return;
                }
                const { commitHash, hard } = body;
                if (!commitHash) {
                    res.status(400).json({ error: 'Commit hash is required' });
                    return;
                }
                const { resetToCommit } = await import('../../services/gitService.js');
                await resetToCommit(commitHash, hard || false);
                res.status(200).json({ success: true, commitHash });
                return;
            }

            case 'diff': {
                const commitHash = typeof req.query?.commitHash === 'string' ? req.query.commitHash : undefined;
                if (!commitHash) {
                    res.status(400).json({ error: 'Commit hash is required' });
                    return;
                }
                const { getCommitDiff } = await import('../../services/gitService.js');
                const diff = await getCommitDiff(commitHash);
                res.status(200).json({ diff });
                return;
            }

            case 'status': {
                const { getStatus, getCurrentBranch } = await import('../../services/gitService.js');
                const status = await getStatus();
                const currentBranch = await getCurrentBranch();
                res.status(200).json({ status, currentBranch });
                return;
            }

            case 'sync-constants': {
                if (req.method !== 'POST') {
                    res.status(405).json({ error: 'Method not allowed' });
                    return;
                }
                const result = await syncConstantsHandler(req);
                res.status(200).json(result);
                return;
            }

            default:
                res.status(400).json({ error: 'Invalid action' });
                return;
        }
    } catch (error: any) {
        const status = Number(error?.status || 500);
        console.error('[git-operations]', action, error?.message || error);
        res.status(status).json({
            error: error?.message || 'Internal server error',
            // Surface a structured hint on git-binary-missing errors so the
            // operator can tell dev-only calls apart from config bugs.
            devOnly: isGitNotFoundError(error),
        });
    }
}

// Tight regex anchored on git-context so unrelated ENOENTs (e.g. missing
// constants.ts) don't get mis-labeled as dev-only.
function isGitNotFoundError(error: any): boolean {
    const msg = String(error?.message || error || '');
    return /git:\s*(?:command )?not found|git executable not found|ENOENT.*git|GIT_TERMINAL/i.test(msg);
}
