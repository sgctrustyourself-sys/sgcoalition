import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { resetPasswordForEmail } from '../services/auth';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await resetPasswordForEmail(email);

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
        }
    };

    if (success) {
        return (
            <AuthLayout title="Check Your Email" subtitle="Reset link sent">
                <div className="text-center space-y-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        If an account exists for <span className="text-white font-bold">{email}</span>,
                        you will receive a password reset link shortly.
                    </p>
                    <div className="pt-4">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-gray-300 transition-colors"
                        >
                            <ArrowRight className="w-4 h-4 rotate-180" /> Back to Login
                        </Link>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Reset Password" subtitle="Enter your email to recover your account">
            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-500 ml-1">Email Address</label>
                    <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="name@example.com"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Reset Link <ArrowRight className="w-4 h-4" /></>}
                </button>
            </form>

            <div className="mt-8 text-center">
                <Link to="/login" className="text-gray-500 text-xs hover:text-white transition-colors flex items-center justify-center gap-2">
                    <ArrowRight className="w-3 h-3 rotate-180" /> Back to Login
                </Link>
            </div>
        </AuthLayout>
    );
};

export default ForgotPassword;
