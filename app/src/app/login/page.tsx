'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useMemo, Suspense } from 'react';
import Image from 'next/image';

/** Floating financial icon for background decoration. */
function FloatingIcon({ icon, className }: { icon: string; className: string }) {
    return (
        <div className={`absolute pointer-events-none select-none ${className}`}>
            <div className="w-12 h-12 rounded-2xl bg-white/5 dark:bg-white/[0.03] backdrop-blur-sm border border-white/10 dark:border-white/5 flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-white/30 dark:text-white/20 text-xl">{icon}</span>
            </div>
        </div>
    );
}

/** Particle dot for ambient background effect. */
function Particles() {
    const particles = useMemo(() =>
        Array.from({ length: 20 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            size: 2 + Math.random() * 3,
            duration: 8 + Math.random() * 12,
            delay: Math.random() * 10,
            opacity: 0.15 + Math.random() * 0.25,
        })), []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="absolute rounded-full bg-primary/40 auth-particle"
                    style={{
                        left: p.left,
                        bottom: '-10px',
                        width: p.size,
                        height: p.size,
                        animationDuration: `${p.duration}s`,
                        animationDelay: `${p.delay}s`,
                        opacity: p.opacity,
                    }}
                />
            ))}
        </div>
    );
}

/** Feature highlight card shown on the left panel. */
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
    return (
        <div className="auth-feature-float bg-white/[0.06] dark:bg-white/[0.03] backdrop-blur-md border border-white/10 dark:border-white/5 rounded-2xl p-4 flex gap-3 items-start">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            </div>
            <div>
                <p className="text-sm font-bold text-white/90">{title}</p>
                <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || (typeof data.error === 'string' ? data.error : 'Login failed'));
            router.push(redirectTo);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen auth-mesh-bg flex relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/15 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 -right-20 w-[400px] h-[400px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 blur-[160px] rounded-full pointer-events-none" />

            {/* Particles */}
            <Particles />

            {/* Floating Icons */}
            <FloatingIcon icon="account_balance" className="top-[15%] left-[8%] auth-float-1" />
            <FloatingIcon icon="trending_up" className="top-[25%] right-[12%] auth-float-2" />
            <FloatingIcon icon="savings" className="bottom-[20%] left-[15%] auth-float-3" />
            <FloatingIcon icon="monitoring" className="bottom-[30%] right-[8%] auth-float-1" />
            <FloatingIcon icon="payments" className="top-[60%] left-[5%] auth-float-2" />

            {/* Left Panel — Feature Showcase (desktop only) */}
            <div className="hidden lg:flex flex-col justify-center w-[45%] px-16 py-12 relative z-10">
                <div className="auth-reveal auth-reveal-1">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 p-0.5 shadow-lg shadow-primary/30">
                            <div className="w-full h-full bg-[#0B0F19] rounded-[13px] flex items-center justify-center p-1.5">
                                <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={40} height={40} className="object-contain rounded-lg" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Wealth AI</h2>
                            <p className="text-xs text-white/40 font-medium">Smart Finance Platform</p>
                        </div>
                    </div>
                </div>

                <div className="auth-reveal auth-reveal-2">
                    <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight mb-4">
                        Your money,
                        <br />
                        <span className="text-gradient-animated">intelligently managed.</span>
                    </h1>
                    <p className="text-white/50 text-base max-w-md leading-relaxed mb-10">
                        AI-powered insights, automated budgets, and real-time tracking — all in one beautiful dashboard.
                    </p>
                </div>

                <div className="space-y-4 auth-reveal auth-reveal-3">
                    <FeatureCard icon="auto_awesome" title="AI-Powered Insights" desc="Get personalized advice based on your spending patterns." />
                    <FeatureCard icon="shield" title="Bank-Grade Security" desc="256-bit encryption with 2FA and session management." />
                    <FeatureCard icon="speed" title="Real-Time Analytics" desc="Track every dollar with beautiful interactive charts." />
                </div>
            </div>

            {/* Right Panel — Login Form */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8 auth-reveal auth-reveal-1">
                        <div className="inline-flex items-center justify-center mb-4">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 p-0.5 shadow-lg shadow-primary/30">
                                <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center p-2">
                                    <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={56} height={56} className="object-contain rounded-xl" />
                                </div>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-white">Wealth AI</h1>
                        <p className="text-white/50 mt-2 text-sm">Sign in to manage your finances</p>
                    </div>

                    {/* Form Card */}
                    <div className="auth-card-glow auth-shimmer auth-reveal auth-reveal-2 rounded-3xl overflow-hidden">
                        <div className="card-glass rounded-3xl p-8 sm:p-10">
                            <div className="hidden lg:block mb-8">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
                                <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Sign in to your account</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-xl p-3.5 flex items-start gap-2 animate-fade-in">
                                        <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-white/70">Email</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 text-lg transition-colors group-focus-within:text-primary">mail</span>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="auth-input w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                                            placeholder="you@example.com"
                                            required
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-white/70">Password</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 text-lg transition-colors group-focus-within:text-primary">lock</span>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="auth-input w-full pl-12 pr-12 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 px-4 bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-primary/25 select-none mt-2 relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Signing in...
                                        </div>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            Sign In
                                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                        </span>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 text-center">
                                <p className="text-sm text-gray-500 dark:text-white/40">
                                    Don&apos;t have an account?{' '}
                                    <a href="/register" onClick={(e) => { e.preventDefault(); router.push('/register'); }} className="text-primary font-semibold hover:underline transition-colors">
                                        Create one
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Trust badges */}
                    <div className="auth-reveal auth-reveal-4 mt-6 flex items-center justify-center gap-6 text-white/25 text-xs">
                        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">verified_user</span> SSL Encrypted</span>
                        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">shield</span> 2FA Ready</span>
                        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">lock</span> SOC2</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen auth-mesh-bg flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
