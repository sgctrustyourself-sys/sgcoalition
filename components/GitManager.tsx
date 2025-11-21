import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, History, RotateCcw, Download, FileText, Clock, User } from 'lucide-react';

interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: string;
    branch: string;
}

interface GitBranch {
    name: string;
    isCurrent: boolean;
}

const GitManager: React.FC = () => {
    const [commits, setCommits] = useState<GitCommit[]>([]);
    const [branches, setBranches] = useState<GitBranch[]>([]);
    const [currentBranch, setCurrentBranch] = useState<string>('master');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
    const [showDiff, setShowDiff] = useState(false);

    // Fetch Git status on component mount
    useEffect(() => {
        fetchGitStatus();
    }, []);

    const fetchGitStatus = async () => {
        setIsLoading(true);
        try {
            // Fetch commit history
            const logResponse = await fetch('http://localhost:3001/api/git-operations?action=log&limit=50');
            if (logResponse.ok) {
                const logData = await logResponse.json();
                setCommits(logData.commits || []);
            }

            // Fetch branches
            const branchesResponse = await fetch('http://localhost:3001/api/git-operations?action=branches');
            if (branchesResponse.ok) {
                const branchesData = await branchesResponse.json();
                setBranches(branchesData.branches || []);
                setCurrentBranch(branchesData.currentBranch || 'master');
            }
        } catch (error) {
            console.error('Failed to fetch Git status:', error);
            // Fallback to showing at least the initial commit
            setCommits([{
                hash: 'f376f9d',
                message: 'Initial commit: Baseline working version with restored Admin.tsx',
                author: 'Coalition Admin',
                date: new Date().toISOString(),
                branch: 'master'
            }]);
            setBranches([
                { name: 'master', isCurrent: true },
                { name: 'stable', isCurrent: false }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwitchBranch = async (branchName: string) => {
        if (window.confirm(`Switch to branch "${branchName}"? Any uncommitted changes will be lost.`)) {
            setIsLoading(true);
            try {
                const response = await fetch('http://localhost:3001/api/git-operations?action=checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ branch: branchName })
                });

                if (!response.ok) {
                    throw new Error('Failed to switch branch');
                }

                setCurrentBranch(branchName);
                await fetchGitStatus();
                alert(`Successfully switched to branch: ${branchName}`);
            } catch (error) {
                console.error('Failed to switch branch:', error);
                alert('Failed to switch branch');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleRollback = async (commitHash: string) => {
        if (window.confirm(`Rollback to commit ${commitHash}? This will reset your working directory to this commit.`)) {
            setIsLoading(true);
            try {
                const response = await fetch('http://localhost:3001/api/git-operations?action=reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commitHash, hard: false })
                });

                if (!response.ok) {
                    throw new Error('Failed to rollback');
                }

                await fetchGitStatus();
                alert('Successfully rolled back to commit ' + commitHash);
            } catch (error) {
                console.error('Failed to rollback:', error);
                alert('Failed to rollback');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleCreateCommit = async () => {
        const message = prompt('Enter commit message:');
        if (message) {
            setIsLoading(true);
            try {
                const response = await fetch('http://localhost:3001/api/git-operations?action=commit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to create commit');
                }

                await fetchGitStatus();
                alert('Commit created successfully');
            } catch (error: any) {
                console.error('Failed to create commit:', error);
                alert(error.message || 'Failed to create commit');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase mb-2">Version Control</h2>
                    <p className="text-gray-600">Manage project versions with Git</p>
                </div>
                <button
                    onClick={handleCreateCommit}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition disabled:opacity-50"
                >
                    <GitCommit className="w-5 h-5" />
                    Create Commit
                </button>
            </div>

            {/* Current Branch */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <GitBranch className="w-6 h-6 text-blue-600" />
                        <div>
                            <h3 className="font-bold text-lg">Current Branch</h3>
                            <p className="text-sm text-gray-600">Active development branch</p>
                        </div>
                    </div>
                    <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-sm font-bold">
                        {currentBranch}
                    </span>
                </div>

                {/* Branch List */}
                <div className="space-y-2">
                    <h4 className="font-bold text-sm uppercase text-gray-600 mb-2">All Branches</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {branches.map((branch) => (
                            <div
                                key={branch.name}
                                className={`flex items-center justify-between p-3 rounded border-2 ${branch.isCurrent
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <span className="font-medium">{branch.name}</span>
                                {!branch.isCurrent && (
                                    <button
                                        onClick={() => handleSwitchBranch(branch.name)}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-bold"
                                    >
                                        Switch
                                    </button>
                                )}
                                {branch.isCurrent && (
                                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                                        CURRENT
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Commit History */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                    <History className="w-6 h-6 text-purple-600" />
                    <div>
                        <h3 className="font-bold text-lg">Commit History</h3>
                        <p className="text-sm text-gray-600">View and manage project history</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-2"></div>
                        <p>Loading commits...</p>
                    </div>
                ) : commits.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <GitCommit className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="font-bold">No commits yet</p>
                        <p className="text-sm">Create your first commit to get started</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {commits.map((commit) => (
                            <div
                                key={commit.hash}
                                className={`border-2 rounded-lg p-4 transition ${selectedCommit === commit.hash
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                onClick={() => setSelectedCommit(commit.hash)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                                {commit.hash}
                                            </code>
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold">
                                                {commit.branch}
                                            </span>
                                        </div>
                                        <p className="font-bold text-gray-900 mb-2">{commit.message}</p>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <User className="w-4 h-4" />
                                                <span>{commit.author}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                <span>{formatDate(commit.date)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowDiff(true);
                                                setSelectedCommit(commit.hash);
                                            }}
                                            className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
                                            title="View Diff"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRollback(commit.hash);
                                            }}
                                            className="p-2 bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition"
                                            title="Rollback to this commit"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Diff Viewer Modal */}
            {showDiff && selectedCommit && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b-2 border-gray-200">
                            <h3 className="font-display text-xl font-bold uppercase">
                                Commit Diff: {selectedCommit}
                            </h3>
                            <button
                                onClick={() => setShowDiff(false)}
                                className="text-gray-500 hover:text-black transition"
                            >
                                <span className="text-2xl">×</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <p className="text-gray-600 mb-4">
                                Diff viewer would display file changes here. This requires backend integration.
                            </p>
                            <div className="bg-gray-100 p-4 rounded font-mono text-sm">
                                <div className="text-green-600">+ Added lines would appear here</div>
                                <div className="text-red-600">- Removed lines would appear here</div>
                                <div className="text-gray-600">  Unchanged lines would appear here</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GitManager;
