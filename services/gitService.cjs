const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// Project root directory
const PROJECT_ROOT = process.cwd();

// Find Git executable
const GIT_PATHS = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe')
];

let GIT_EXECUTABLE = 'git'; // fallback

for (const gitPath of GIT_PATHS) {
    try {
        if (fs.existsSync(gitPath)) {
            GIT_EXECUTABLE = `"${gitPath}"`;
            console.log(`✓ Found Git at: ${gitPath}`);
            break;
        }
    } catch (e) {
        // continue checking
    }
}

/**
 * Execute a Git command safely
 */
async function executeGitCommand(command) {
    try {
        // Replace 'git' with full path (match git followed by space or end of string)
        const fullCommand = command.replace(/^git(\s|$)/, `${GIT_EXECUTABLE}$1`);

        const { stdout, stderr } = await execAsync(fullCommand, {
            cwd: PROJECT_ROOT,
            env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0'
            }
        });

        if (stderr && !stderr.includes('warning')) {
            console.error('Git stderr:', stderr);
        }

        return stdout.trim();
    } catch (error) {
        console.error('Git command failed:', error.message);
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
        await executeGitCommand(
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

            // Extract branch name from refs
            let branch = 'master';
            if (refs) {
                const branchMatch = refs.match(/HEAD -> ([^,]+)/);
                if (branchMatch) {
                    branch = branchMatch[1].trim();
                } else {
                    const firstBranch = refs.split(',')[0].trim();
                    branch = firstBranch || 'master';
                }
            }

            return {
                hash: hash.trim(),
                message: message.trim(),
                author: author.trim(),
                date: date.trim(),
                branch: branch
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

        // Check if branch exists
        const branches = await getBranches();
        const branchExists = branches.some(b => b.name === sanitizedBranch);

        if (!branchExists) {
            throw new Error(`Branch "${sanitizedBranch}" does not exist`);
        }

        // Switch branch
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
        // Sanitize commit hash
        const sanitizedHash = commitHash.replace(/[^a-f0-9]/g, '');

        // Verify commit exists
        await executeGitCommand(`git cat-file -e ${sanitizedHash}`);

        // Reset to commit
        const resetType = hard ? '--hard' : '--soft';
        await executeGitCommand(`git reset ${resetType} ${sanitizedHash}`);
    } catch (error) {
        throw new Error(`Failed to reset to commit: ${error.message}`);
    }
}

/**
 * Get diff for a commit
 */
async function getCommitDiff(commitHash) {
    try {
        // Sanitize commit hash
        const sanitizedHash = commitHash.replace(/[^a-f0-9]/g, '');

        // Get diff
        const diff = await executeGitCommand(`git show ${sanitizedHash}`);

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
