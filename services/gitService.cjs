const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

// Project root directory
const PROJECT_ROOT = process.cwd();

/**
 * Execute a Git command safely
 */
async function executeGitCommand(command) {
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: PROJECT_ROOT,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
        });

        if (stderr && !stderr.includes('warning')) {
            console.error('Git stderr:', stderr);
        }

        return stdout.trim();
    } catch (error) {
        console.error('Git command failed:', error);
        throw new Error(`Git operation failed: ${error.message}`);
    }
}

/**
 * Create a Git commit with a message
 */
async function createCommit(message, author) {
    try {
        // Sanitize commit message
        const sanitizedMessage = message.replace(/["`$]/g, '');

        // Stage all changes
        await executeGitCommand('git add -A');

        // Check if there are changes to commit
        const status = await executeGitCommand('git status --porcelain');
        if (!status) {
            return 'No changes to commit';
        }

        // Create commit
        const authorFlag = author ? `--author="${author}"` : '';
        const result = await executeGitCommand(
            `git commit -m "${sanitizedMessage}" ${authorFlag}`
        );

        // Get the commit hash
        const hash = await executeGitCommand('git rev-parse --short HEAD');

        return hash;
    } catch (error) {
        throw new Error(`Failed to create commit: ${error.message}`);
    }
}

/**
 * Get commit history
 */
async function getCommitHistory(limit = 50) {
    try {
        const format = '%h|%s|%an|%ai|%D';
        const log = await executeGitCommand(
            `git log --pretty=format:"${format}" -n ${limit}`
        );

        if (!log) {
            return [];
        }

        const commits = log.split('\n').map(line => {
            const [hash, message, author, date, refs] = line.split('|');
            return {
                hash: hash.trim(),
                message: message.trim(),
                author: author.trim(),
                date: date.trim()
            };
        });

        return commits;
    } catch (error) {
        throw new Error(`Failed to get commit history: ${error.message}`);
    }
}

/**
 * Get list of branches
 */
async function getBranches() {
    try {
        const output = await executeGitCommand('git branch');

        const branches = output.split('\n').map(line => {
            const isCurrent = line.startsWith('*');
            const name = line.replace('*', '').trim();
            return { name, isCurrent };
        });

        return branches;
    } catch (error) {
        throw new Error(`Failed to get branches: ${error.message}`);
    }
}

/**
 * Switch to a different branch
 */
async function switchBranch(branchName) {
    try {
        // Sanitize branch name
        const sanitizedBranch = branchName.replace(/[^a-zA-Z0-9_\-\/]/g, '');
        await executeGitCommand(`git checkout ${sanitizedBranch}`);
    } catch (error) {
        throw new Error(`Failed to switch branch: ${error.message}`);
    }
}

/**
 * Reset to a specific commit
 */
async function resetToCommit(commitHash, hard = false) {
    try {
        const resetType = hard ? '--hard' : '--soft';
        await executeGitCommand(`git reset ${resetType} ${commitHash}`);
    } catch (error) {
        throw new Error(`Failed to reset to commit: ${error.message}`);
    }
}

/**
 * Get diff for a commit
 */
async function getCommitDiff(commitHash) {
    try {
        const diff = await executeGitCommand(`git show ${commitHash}`);
        return diff;
    } catch (error) {
        throw new Error(`Failed to get commit diff: ${error.message}`);
    }
}

/**
 * Get current branch name
 */
async function getCurrentBranch() {
    try {
        const branch = await executeGitCommand('git rev-parse --abbrev-ref HEAD');
        return branch;
    } catch (error) {
        throw new Error(`Failed to get current branch: ${error.message}`);
    }
}

/**
 * Check if Git repository is initialized
 */
async function isGitRepository() {
    try {
        await executeGitCommand('git rev-parse --git-dir');
        return true;
    } catch {
        return false;
    }
}

/**
 * Get repository status
 */
async function getStatus() {
    try {
        const status = await executeGitCommand('git status --short');
        return status;
    } catch (error) {
        throw new Error(`Failed to get status: ${error.message}`);
    }
}

module.exports = {
    executeGitCommand,
    createCommit,
    getCommitHistory,
    getBranches,
    switchBranch,
    resetToCommit,
    getCommitDiff,
    getCurrentBranch,
    isGitRepository,
    getStatus
};
