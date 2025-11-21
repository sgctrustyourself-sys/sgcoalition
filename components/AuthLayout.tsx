import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>

            <div className="relative z-10 w-full max-w-md px-4">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block font-display text-4xl font-bold uppercase tracking-widest text-white mb-2 hover:text-glow transition-all">
                        Coalition
                    </Link>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl ring-1 ring-white/5">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                        {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
