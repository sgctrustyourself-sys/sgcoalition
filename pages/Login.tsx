import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, Shield, Hexagon, Check } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { signInWithEmail, signInWithDiscord } from '../services/auth';
import { useApp } from '../context/AppContext';
import { AuthProvider } from '../types';

const Login = () => {
    const navigate = useNavigate();
    const { login } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [rememberMe, setRememberMe] = useState(false);

    React.useEffect(() => {
        const savedEmail = localStorage.getItem('coalition_remembered_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (rememberMe) {
            localStorage.setItem('coalition_remembered_email', email);
        } else {
            localStorage.removeItem('coalition_remembered_email');
        }

        const { error } = await signInWithEmail(email, password);
        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            navigate('/');
        }
    };

    const handleDiscordLogin = async () => {
        // Discord login kept for future activation but hidden in UI
        const { error } = await signInWithDiscord();
        if (error) setError(error.message);
    };

    const handleMetaMaskLogin = async () => {
        try {
            await login(AuthProvider.METAMASK);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Failed to connect wallet');
        }
    };

    return (
        <AuthLayout title="Welcome Back" subtitle="Sign in to access your account" className="antigravity-card">
            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
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
                            autoComplete="email"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-bold uppercase text-gray-500">Password</label>
                    </div>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-purple-600 border-purple-600' : 'border-gray-600 group-hover:border-gray-400'}`}>
                            {rememberMe && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <input
                            type="checkbox"
                            className="hidden"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <span className="text-gray-400 group-hover:text-gray-300 transition-colors">Remember me</span>
                    </label>
                    <Link to="/forgot-password" className="text-gray-400 hover:text-white transition-colors">Forgot Password?</Link>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                </button>
            </form>

            {/* MetaMask - Optional, de-emphasized */}
            <details className="mt-6">
                <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400 transition-colors text-center">
                    Advanced: Connect with Crypto Wallet
                </summary>
                <button
                    onClick={handleMetaMaskLogin}
                    className="w-full mt-4 bg-white/5 border border-white/10 text-gray-400 font-bold text-sm py-3 rounded-lg hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                    <Hexagon className="w-4 h-4" /> Connect MetaMask
                </button>
            </details>

            <div className="mt-8 text-center">
                <p className="text-gray-500 text-xs">
                    Don't have an account?{' '}<Link to="/signup" className="text-white font-bold hover:underline">Sign Up</Link>
                </p>
            </div>
        </AuthLayout>
    );
};

export default Login;
