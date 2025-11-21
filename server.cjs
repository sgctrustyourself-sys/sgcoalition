const express = require('express');
const cors = require('cors');
const path = require('path');

// Import Git service functions
const gitService = require('./services/gitService.cjs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Git operations endpoint
app.all('/api/git-operations', async (req, res) => {
    try {
        // Check if Git repository exists
        const isRepo = await gitService.isGitRepository();
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

                const hash = await gitService.createCommit(message, author);
                return res.status(200).json({ success: true, hash });
            }

            case 'log': {
                const limit = parseInt(req.query.limit) || 50;
                const commits = await gitService.getCommitHistory(limit);
                return res.status(200).json({ commits });
            }

            case 'branches': {
                const branches = await gitService.getBranches();
                const currentBranch = await gitService.getCurrentBranch();
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

                await gitService.switchBranch(branch);
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

                await gitService.resetToCommit(commitHash, hard || false);
                return res.status(200).json({ success: true, commitHash });
            }

            case 'diff': {
                const { commitHash } = req.query;
                if (!commitHash) {
                    return res.status(400).json({ error: 'Commit hash is required' });
                }

                const diff = await gitService.getCommitDiff(commitHash);
                return res.status(200).json({ diff });
            }

            case 'status': {
                const status = await gitService.getStatus();
                const currentBranch = await gitService.getCurrentBranch();
                return res.status(200).json({ status, currentBranch });
            }

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Git operation error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Git API server is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Git API server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/api/git-operations`);
});
