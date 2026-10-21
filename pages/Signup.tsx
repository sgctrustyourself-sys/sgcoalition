import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader2, Phone, MapPin, Bell } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { signUpWithEmail, signInWithDiscord } from '../services/auth';
import { toE164 } from '../utils/phone';

const Signup = () => {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // Contact capture — the 30% member offer doubles as an acquisition
    // offer, so we ask for a way to reach the member and where to ship drops.
    const [phone, setPhone] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressCity, setAddressCity] = useState('');
    const [addressState, setAddressState] = useState('');
    const [addressZip, setAddressZip] = useState('');
    // Marketing opt-in. The member offer is an acquisition offer, so a new
    // member is a contact we can reach — but only if they say yes, and only
    // with a phone number we can text.
    const [optIn, setOptIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await signUpWithEmail(email, password, fullName, {
            phone,
            addressLine1,
            addressCity,
            addressState,
            addressZip,
            addressCountry: 'US',
        });

        if (error) {
            console.error('❌ Signup error details:', error);
            // Log full error object for debugging
            if (error instanceof Object) {
                console.error('Error code:', (error as any).code);
                console.error('Error details:', (error as any).details);
                console.error('Error hint:', (error as any).hint);
                const detailedError = (error as any).details || (error as any).message || JSON.stringify(error);
                setError(`Database Error: ${detailedError}`);
            } else {
                setError(String(error));
            }
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
            // Opt-in contact. Fire-and-forget: a failed subscribe must never
            // turn a successful account creation into a failed signup. The
            // phone has to be E.164 — without one we can still reach the
            // member by email.
            if (optIn) {
                const e164 = toE164(phone);
                void fetch('/api/marketing-subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email.trim(),
                        ...(e164 ? { phone: e164 } : {}),
                        source: 'member_signup',
                    }),
                }).catch(() => { /* the account exists; the opt-in can be re-asked later */ });
            }
        }
    };

    const handleDiscordLogin = async () => {
        const { error } = await signInWithDiscord();
        if (error) setError(error.message);
    };

    if (success) {
        return (
            <AuthLayout title="Check Your Email" subtitle="Verification link sent">
                <div className="text-center space-y-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        We've sent a verification link to <span className="text-white font-bold">{email}</span>.
                        Please check your inbox to complete your registration.
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
        <AuthLayout title="Create Account" subtitle="Members get 30% off every piece — automatically at checkout">
            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center break-words">
                    <p className="font-bold">Signup Failed</p>
                    {error}
                </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-500 ml-1">Full Name</label>
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="John Doe"
                            required
                        />
                    </div>
                </div>

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

                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-500 ml-1">Password</label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="Create a password"
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-500 ml-1">Phone Number</label>
                    <div className="relative group">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="(410) 555-0123"
                            autoComplete="tel"
                        />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1 ml-1">Optional — drop alerts and early access, nothing else.</p>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-500 ml-1">Shipping Address</label>
                    <div className="relative group">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            value={addressLine1}
                            onChange={(e) => setAddressLine1(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="Street address"
                            autoComplete="address-line1"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <input
                            type="text"
                            value={addressCity}
                            onChange={(e) => setAddressCity(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="City"
                            autoComplete="address-level2"
                        />
                        <input
                            type="text"
                            value={addressState}
                            onChange={(e) => setAddressState(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="State"
                            autoComplete="address-level1"
                        />
                        <input
                            type="text"
                            value={addressZip}
                            onChange={(e) => setAddressZip(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
                            placeholder="ZIP"
                            autoComplete="postal-code"
                        />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1 ml-1">Optional — so a drop can ship to you without another form.</p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={optIn}
                        onChange={(e) => setOptIn(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-pink-500 flex-shrink-0"
                    />
                    <span className="text-xs text-gray-400 leading-relaxed">
                        <Bell className="w-3 h-3 inline mr-1 -mt-0.5" />
                        Text me when a drop goes live. One message per drop, unsubscribe any time.
                    </span>
                </label>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
                </button>
            </form>

            {/* Discord - Optional, de-emphasized */}
            <details className="mt-6">
                <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400 transition-colors text-center">
                    Advanced: Sign up with Discord
                </summary>
                <button
                    onClick={handleDiscordLogin}
                    className="w-full mt-4 bg-white/5 border border-white/10 text-gray-400 font-bold text-sm py-3 rounded-lg hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.5328-9.7135-3.5686-13.638a.076.076 0 00-.0325-.03zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
                    </svg>
                    Discord
                </button>
            </details>

            <div className="mt-8 text-center">
                <p className="text-gray-500 text-xs">
                    Already have an account?{' '}
                    <Link to="/login" className="text-white font-bold hover:underline">Sign In</Link>
                </p>
            </div>
        </AuthLayout>
    );
};

export default Signup;
