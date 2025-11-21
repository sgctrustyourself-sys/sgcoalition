// Generic types for API handler (compatible with both Vercel and local development)
type ApiRequest = {
    method?: string;
    query: { [key: string]: string | string[] | undefined };
    body: any;
};

type ApiResponse = {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => ApiResponse;
    json: (data: any) => void;
    end: () => void;
};

import {
    createCommit,
    getCommitHistory,
    getBranches,
    switchBranch,
    resetToCommit,
    getCommitDiff,
    getCurrentBranch,
    isGitRepository,
    getStatus
} from '../services/gitService';

export default async function handler(req: ApiRequest, res: ApiResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Check if Git repository exists
        const isRepo = await isGitRepository();
        if (!isRepo) {
            return res.status(500).json({ error: 'Git repository not initialized' });
        }

        const { action } = req.query;

        switch (action) {
            case 'commit': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { message, author } = req.body;
                if (!message) {
                    return res.status(400).json({ error: 'Commit message is required' });
                }

                const hash = await createCommit(message, author);
                return res.status(200).json({ success: true, hash });
            }

            case 'log': {
                const limit = parseInt(req.query.limit as string) || 50;
                const commits = await getCommitHistory(limit);
                return res.status(200).json({ commits });
            }

            case 'branches': {
                const branches = await getBranches();
                const currentBranch = await getCurrentBranch();
                return res.status(200).json({ branches, currentBranch });
            }

            case 'checkout': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { branch } = req.body;
                if (!branch) {
                    return res.status(400).json({ error: 'Branch name is required' });
                }

                await switchBranch(branch);
                return res.status(200).json({ success: true, branch });
            }

            case 'reset': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { commitHash, hard } = req.body;
                if (!commitHash) {
                    return res.status(400).json({ error: 'Commit hash is required' });
                }

                await resetToCommit(commitHash, hard || false);
                return res.status(200).json({ success: true, commitHash });
            }

            case 'diff': {
                const { commitHash } = req.query;
                if (!commitHash) {
                    return res.status(400).json({ error: 'Commit hash is required' });
                }

                const diff = await getCommitDiff(commitHash as string);
                return res.status(200).json({ diff });
            }

            case 'status': {
                const status = await getStatus();
                const currentBranch = await getCurrentBranch();
                return res.status(200).json({ status, currentBranch });
            }

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error: any) {
        console.error('Git operation error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
