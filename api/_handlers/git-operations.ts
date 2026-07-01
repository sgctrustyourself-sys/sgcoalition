// /api/git-operations
// Tiny dispatcher over the local services/gitService helpers — keeps the
// admin dashboard's Git UI in lockstep with the CLI workflow.
// Actions (all via ?action=...): commit, log, branches, checkout, reset, diff, status.
// State-mutating actions require POST; reads accept GET.

import {
    createCommit,
    getCommitHistory,
    getBranches,
    switchBranch,
    resetToCommit,
    getCommitDiff,
    getCurrentBranch,
    isGitRepository,
    getStatus,
} from '../../services/gitService';
import type { GitBranch, GitCommit } from '../../services/gitService';
import { createHttpError, parseBody, setCorsHeaders, type HttpError } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    GitCheckoutInput,
    GitCommitInput,
    GitResetInput,
} from '../_types';

const DEFAULT_LOG_LIMIT = 50;

function readQueryString(query: ApiRequest['query'], key: string): string | undefined {
    const raw = query?.[key];
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
    return undefined;
}

async function handleCommit(req: ApiRequest): Promise<{ success: true; hash: string }> {
    if (req.method !== 'POST') throw createHttpError(405, 'Method not allowed');
    const rawBody = parseBody(req);
    const body = rawBody as GitCommitInput;
    const message = String(body.message || '').trim();
    if (!message) throw createHttpError(400, 'Commit message is required');
    const author = body.author ? String(body.author) : undefined;
    const hash = await createCommit(message, author);
    return { success: true, hash };
}

async function handleLog(req: ApiRequest): Promise<{ commits: GitCommit[] }> {
    const limitRaw = readQueryString(req.query, 'limit');
    const limit = limitRaw ? parseInt(limitRaw, 10) : DEFAULT_LOG_LIMIT;
    const commits = await getCommitHistory(Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LOG_LIMIT);
    return { commits };
}

async function handleBranches(): Promise<{ branches: GitBranch[]; currentBranch: string }> {
    const branches = await getBranches();
    const currentBranch = await getCurrentBranch();
    return { branches, currentBranch };
}

async function handleCheckout(req: ApiRequest): Promise<{ success: true; branch: string }> {
    if (req.method !== 'POST') throw createHttpError(405, 'Method not allowed');
    const rawBody = parseBody(req);
    const body = rawBody as GitCheckoutInput;
    const branch = String(body.branch || '').trim();
    if (!branch) throw createHttpError(400, 'Branch name is required');
    await switchBranch(branch);
    return { success: true, branch };
}

async function handleReset(req: ApiRequest): Promise<{ success: true; commitHash: string }> {
    if (req.method !== 'POST') throw createHttpError(405, 'Method not allowed');
    const rawBody = parseBody(req);
    const body = rawBody as GitResetInput;
    const commitHash = String(body.commitHash || '').trim();
    if (!commitHash) throw createHttpError(400, 'Commit hash is required');
    const hard = Boolean(body.hard);
    await resetToCommit(commitHash, hard);
    return { success: true, commitHash };
}

async function handleDiff(req: ApiRequest): Promise<{ diff: string }> {
    const commitHash = readQueryString(req.query, 'commitHash');
    if (!commitHash) throw createHttpError(400, 'Commit hash is required');
    const diff = await getCommitDiff(commitHash);
    return { diff };
}

async function handleStatus(): Promise<{ status: string; currentBranch: string }> {
    const status = await getStatus();
    const currentBranch = await getCurrentBranch();
    return { status, currentBranch };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { methods: 'GET, POST, OPTIONS' });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const isRepo = await isGitRepository();
        if (!isRepo) {
            res.status(500).json({ error: 'Git repository not initialized' });
            return;
        }

        const action = readQueryString(req.query, 'action');

        switch (action) {
            case 'commit':
                res.status(200).json(await handleCommit(req));
                return;
            case 'log':
                res.status(200).json(await handleLog(req));
                return;
            case 'branches':
                res.status(200).json(await handleBranches());
                return;
            case 'checkout':
                res.status(200).json(await handleCheckout(req));
                return;
            case 'reset':
                res.status(200).json(await handleReset(req));
                return;
            case 'diff':
                res.status(200).json(await handleDiff(req));
                return;
            case 'status':
                res.status(200).json(await handleStatus());
                return;
            default:
                res.status(400).json({ error: 'Invalid action' });
                return;
        }
    } catch (error: unknown) {
        const message = (error as { message?: string } | null)?.message;
        const httpError = error as HttpError | null;
        const status = Number(httpError?.status || 500);
        console.error('Git operation error:', error);
        res.status(status).json({ error: message || 'Internal server error' });
    }
}
