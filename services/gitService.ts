import { exec } from 'child_process';
import { promisify } from 'util';
import { errorMessage } from '../utils/errorMessage.js';

const execAsync = promisify(exec);

// Project root directory
const PROJECT_ROOT = process.cwd();

export interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: string;
    branch: string;
}

export interface GitBranch {
    name: string;
    isCurrent: boolean;
}

/**
 * Execute a Git command safely
 */
async function executeGitCommand(command: string): Promise<string> {
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
        throw new Error(`Git operation failed: ${errorMessage(error)}`);
    }
}

/**
 * Create a Git commit with a message
 */
export async function createCommit(message: string, author?: string): Promise<string> {
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
        throw new Error(`Failed to create commit: ${errorMessage(error)}`);
    }
}

/**
 * Get commit history
 */
export async function getCommitHistory(limit: number = 50): Promise<GitCommit[]> {
    try {
        const format = '%h|%s|%an|%ai|%D';
        const log = await executeGitCommand(
            `git log --pretty=format:"${format}" -n ${limit}`
        );

        if (!log) {
            return [];
        }

        const commits: GitCommit[] = log.split('\n').map(line => {
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
        throw new Error(`Failed to get commit history: ${errorMessage(error)}`);
    }
}

/**
 * Get list of branches
 */
export async function getBranches(): Promise<GitBranch[]> {
    try {
        const output = await executeGitCommand('git branch');

        const branches: GitBranch[] = output.split('\n').map(line => {
            const isCurrent = line.startsWith('*');
            const name = line.replace('*', '').trim();
            return { name, isCurrent };
        });

        return branches;
    } catch (error) {
        throw new Error(`Failed to get branches: ${errorMessage(error)}`);
    }
}

/**
 * Switch to a different branch
 */
export async function switchBranch(branchName: string): Promise<void> {
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
        throw new Error(`Failed to switch branch: ${errorMessage(error)}`);
    }
}

/**
 * Reset to a specific commit
 */
export async function resetToCommit(commitHash: string, hard: boolean = false): Promise<void> {
    try {
        // Sanitize commit hash
        const sanitizedHash = commitHash.replace(/[^a-f0-9]/g, '');

        // Verify commit exists
        await executeGitCommand(`git cat-file -e ${sanitizedHash}`);

        // Reset to commit
        const resetType = hard ? '--hard' : '--soft';
        await executeGitCommand(`git reset ${resetType} ${sanitizedHash}`);
    } catch (error) {
        throw new Error(`Failed to reset to commit: ${errorMessage(error)}`);
    }
}

/**
 * Get diff for a commit
 */
export async function getCommitDiff(commitHash: string): Promise<string> {
    try {
        // Sanitize commit hash
        const sanitizedHash = commitHash.replace(/[^a-f0-9]/g, '');

        // Get diff
        const diff = await executeGitCommand(`git show ${sanitizedHash}`);

        return diff;
    } catch (error) {
        throw new Error(`Failed to get commit diff: ${errorMessage(error)}`);
    }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
    try {
        const branch = await executeGitCommand('git rev-parse --abbrev-ref HEAD');
        return branch;
    } catch (error) {
        throw new Error(`Failed to get current branch: ${errorMessage(error)}`);
    }
}

/**
 * Check if Git repository is initialized
 */
export async function isGitRepository(): Promise<boolean> {
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
export async function getStatus(): Promise<string> {
    try {
        const status = await executeGitCommand('git status --short');
        return status;
    } catch (error) {
        throw new Error(`Failed to get status: ${errorMessage(error)}`);
    }
}
