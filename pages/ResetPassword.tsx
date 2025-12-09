import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { supabase } from '../services/supabase';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check if we have a valid session from the reset link
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setError(null);
            } else {
                // If no session immediately, wait a bit as Supabase might be processing the hash
                // The onAuthStateChange below will catch it if it comes in
                setError('Verifying session...');
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || session) {
                setError(null);
            } else if (event === 'SIGNED_OUT') {
                setError('Auth session missing! Please request a new reset link.');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) {
                setError(error.message);
            } else {
                setSuccess(true);
                setTimeout(() => navigate('/login'), 3000);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <AuthLayout title="Password Reset" subtitle="Your password has been updated" className="antigravity-card">
                <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full mb-4">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-gray-300 text-sm mb-6">
                        Your password has been successfully reset!
                    </p>
                    <p className="text-gray-500 text-xs">
                        Redirecting to login...
                    </p>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Set New Password" subtitle="Enter your new password" className="antigravity-card">
            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-500 ml-1">New Password</label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-500 ml-1">Confirm Password</label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                </button>
            </form>
        </AuthLayout>
    );
};

export default ResetPassword;
