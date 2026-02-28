import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, History, RotateCcw, FileText, Clock, User, AlertCircle, CheckCircle } from 'lucide-react';

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

const GitControl: React.FC = () => {
    const [commits, setCommits] = useState<GitCommit[]>([]);
    const [branches, setBranches] = useState<GitBranch[]>([]);
    const [currentBranch, setCurrentBranch] = useState<string>('master');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
    const [showDiff, setShowDiff] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

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
            // Fallback for demo/dev if API fails
            setCommits([{
                hash: 'f376f9d',
                message: 'Initial commit: Baseline working version',
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

                if (!response.ok) throw new Error('Failed to switch branch');

                setCurrentBranch(branchName);
                await fetchGitStatus();
                setSuccess(`Switched to ${branchName}`);
                setTimeout(() => setSuccess(null), 3000);
            } catch (err) {
                console.error('Failed to switch branch:', err);
                setError('Failed to switch branch');
                setTimeout(() => setError(null), 3000);
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
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to create commit');
                }

                await fetchGitStatus();
                setSuccess('Commit created successfully');
                setTimeout(() => setSuccess(null), 3000);
            } catch (err: any) {
                console.error('Failed to create commit:', err);
                setError(err.message || 'Failed to create commit');
                setTimeout(() => setError(null), 3000);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase text-white">Version Control</h2>
                    <p className="text-gray-400 text-sm">Manage project versions with Git</p>
                </div>
                <button
                    onClick={handleCreateCommit}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-bold uppercase text-sm hover:bg-gray-200 transition disabled:opacity-50"
                >
                    <GitCommit className="w-4 h-4" />
                    Create Commit
                </button>
            </div>

            {/* Feedback */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg flex items-center gap-3">
                    <CheckCircle className="w-5 h-5" />
                    {success}
                </div>
            )}

            {/* Current Branch */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <GitBranch className="w-6 h-6 text-blue-400" />
                        <div>
                            <h3 className="font-bold text-lg text-white">Current Branch</h3>
                            <p className="text-sm text-gray-400">Active development branch</p>
                        </div>
                    </div>
                    <span className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg font-bold border border-blue-500/30">
                        {currentBranch}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {branches.map((branch) => (
                        <div
                            key={branch.name}
                            className={`flex items-center justify-between p-3 rounded-lg border ${branch.isCurrent
                                    ? 'border-blue-500/50 bg-blue-500/10 text-white'
                                    : 'border-white/10 hover:bg-white/5 text-gray-400'
                                }`}
                        >
                            <span className="font-medium font-mono">{branch.name}</span>
                            {!branch.isCurrent && (
                                <button
                                    onClick={() => handleSwitchBranch(branch.name)}
                                    className="text-xs text-blue-400 hover:text-white font-bold uppercase"
                                >
                                    Switch
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Commit History */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                    <History className="w-6 h-6 text-purple-400" />
                    <div>
                        <h3 className="font-bold text-lg text-white">Commit History</h3>
                        <p className="text-sm text-gray-400">Recent changes</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-12 text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                        <p>Loading...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {commits.map((commit) => (
                            <div
                                key={commit.hash}
                                className={`border rounded-lg p-4 transition cursor-pointer ${selectedCommit === commit.hash
                                        ? 'border-purple-500/50 bg-purple-500/10'
                                        : 'border-white/10 hover:bg-white/5'
                                    }`}
                                onClick={() => setSelectedCommit(commit.hash)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <code className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono text-brand-accent">
                                                {commit.hash.substring(0, 7)}
                                            </code>
                                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold border border-green-500/30">
                                                {commit.branch}
                                            </span>
                                        </div>
                                        <p className="font-bold text-white mb-2">{commit.message}</p>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                <span>{commit.author}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
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
                                            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GitControl;
