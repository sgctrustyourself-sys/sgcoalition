import React, { useState } from 'react';
import { AlertCircle, BellRing, CheckCircle2, Loader2, Mail, Send, Smartphone } from 'lucide-react';

type CaptureMode = 'email' | 'sms';
type CaptureSource = 'product' | 'custom_wallets' | 'shop' | 'home';

interface DropLeadCaptureProps {
    source?: CaptureSource;
    productId?: string;
    heading?: string;
    subheading?: string;
    className?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DropLeadCapture: React.FC<DropLeadCaptureProps> = ({
    source = 'product',
    productId,
    heading = 'Get the next drop first',
    subheading = 'One note when a new piece goes live. No spam.',
    className = '',
}) => {
    const [mode, setMode] = useState<CaptureMode>('email');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('+1');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');

    const resetFeedback = () => {
        if (status === 'error') setStatus('idle');
        if (error) setError('');
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (status === 'submitting') return;

        setError('');

        const trimmedEmail = email.trim().toLowerCase();
        const normalizedPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
        const isEmailMode = mode === 'email';

        if (isEmailMode && !EMAIL_REGEX.test(trimmedEmail)) {
            setStatus('error');
            setError('Enter a valid email.');
            return;
        }

        if (!isEmailMode && !/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
            setStatus('error');
            setError('Enter a valid phone number.');
            return;
        }

        setStatus('submitting');

        try {
            const response = await fetch('/api/marketing-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: isEmailMode ? trimmedEmail : null,
                    phone: isEmailMode ? null : normalizedPhone,
                    countryCode,
                    channel: mode,
                    source,
                    productId: productId || null,
                    pagePath: typeof window !== 'undefined' ? window.location.pathname : null,
                    consentText: isEmailMode
                        ? 'Coalition drop list: email updates for new drops, early access, and exclusive offers. Unsubscribe any time.'
                        : 'Coalition Signal: SMS notifications for drops, early access, and exclusive offers. Standard message rates may apply. Reply STOP to opt out at any time.',
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'Could not save this signup.');
            }

            setStatus('success');
            setEmail('');
            setPhone('');
        } catch (err: any) {
            setStatus('error');
            setError(err?.message || 'Could not save this signup.');
        }
    };

    return (
        <div className={`border border-white/10 bg-white/[0.03] px-4 py-5 ${className}`}>
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-brand-accent/30 bg-brand-accent/10 text-brand-accent">
                    <BellRing className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-white">{heading}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-400">{subheading}</p>
                </div>
            </div>

            {status === 'success' ? (
                <div className="mt-4 flex items-center gap-2 border border-green-500/30 bg-green-500/10 px-3 py-3 text-sm font-bold uppercase tracking-[0.16em] text-green-300">
                    <CheckCircle2 className="h-4 w-4" />
                    You are on the list.
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
                    <div className="grid grid-cols-2 border border-white/10">
                        {([
                            { value: 'email' as const, label: 'Email', icon: Mail },
                            { value: 'sms' as const, label: 'SMS', icon: Smartphone },
                        ]).map(option => {
                            const Icon = option.icon;
                            const active = mode === option.value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        setMode(option.value);
                                        resetFeedback();
                                    }}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                                        active
                                            ? 'bg-white text-black'
                                            : 'bg-black/40 text-gray-400 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>

                    {mode === 'email' ? (
                        <label className="block">
                            <span className="sr-only">Email address</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => {
                                    setEmail(event.target.value);
                                    resetFeedback();
                                }}
                                placeholder="EMAIL ADDRESS"
                                disabled={status === 'submitting'}
                                className="w-full border border-white/10 bg-black/50 px-3 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-white/40 disabled:opacity-60"
                            />
                        </label>
                    ) : (
                        <div className="flex gap-2">
                            <label className="w-24">
                                <span className="sr-only">Country code</span>
                                <select
                                    value={countryCode}
                                    onChange={(event) => setCountryCode(event.target.value)}
                                    disabled={status === 'submitting'}
                                    className="h-full w-full border border-white/10 bg-black/50 px-2 py-3 text-center text-sm text-white outline-none transition focus:border-white/40 disabled:opacity-60"
                                >
                                    <option value="+1">US +1</option>
                                    <option value="+44">UK +44</option>
                                    <option value="+61">AU +61</option>
                                </select>
                            </label>
                            <label className="block flex-1">
                                <span className="sr-only">Phone number</span>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(event) => {
                                        setPhone(event.target.value);
                                        resetFeedback();
                                    }}
                                    placeholder="PHONE NUMBER"
                                    disabled={status === 'submitting'}
                                    className="w-full border border-white/10 bg-black/50 px-3 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-white/40 disabled:opacity-60"
                                />
                            </label>
                        </div>
                    )}

                    {status === 'error' && error && (
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-red-300">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'submitting'}
                        className="flex w-full items-center justify-center gap-2 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-brand-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {status === 'submitting' ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving
                            </>
                        ) : (
                            <>
                                Notify Me
                                <Send className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </form>
            )}
        </div>
    );
};

export default DropLeadCapture;
