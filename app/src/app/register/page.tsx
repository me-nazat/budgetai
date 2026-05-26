'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
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

/** Particle dots for ambient background. */
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
                    className="absolute rounded-full bg-emerald-400/40 auth-particle"
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

/** Password strength calculator and indicator. */
function PasswordStrength({ password }: { password: string }) {
    const checks = [
        { label: 'At least 6 characters', pass: password.length >= 6 },
        { label: 'Contains a number', pass: /\d/.test(password) },
        { label: 'Contains uppercase', pass: /[A-Z]/.test(password) },
        { label: 'Contains special char', pass: /[^A-Za-z0-9]/.test(password) },
    ];

    const strength = checks.filter(c => c.pass).length;
    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
    const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'][strength];
    const strengthWidth = `${(strength / 4) * 100}%`;

    if (!password) return null;

    return (
        <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full password-strength-bar"
                        style={{ width: strengthWidth, backgroundColor: strengthColor }}
                    />
                </div>
                <span className="text-xs font-bold" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
                {checks.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span className={`material-symbols-outlined text-sm transition-colors duration-300 ${c.pass ? 'text-emerald-500' : 'text-gray-300 dark:text-white/20'}`}
                            style={{ fontVariationSettings: c.pass ? "'FILL' 1" : "'FILL' 0" }}>
                            {c.pass ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={`transition-colors ${c.pass ? 'text-gray-600 dark:text-white/60' : 'text-gray-400 dark:text-white/25'}`}>{c.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirm) { setError('Passwords do not match'); return; }
        setLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || (typeof data.error === 'string' ? data.error : 'Registration failed'));
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    // Progress dots
    const step = name ? (email ? (password ? 3 : 2) : 1) : 0;

    return (
        <div className="min-h-screen auth-mesh-bg flex relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute top-1/3 -left-20 w-[500px] h-[500px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/3 -right-20 w-[400px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 blur-[160px] rounded-full pointer-events-none" />

            <Particles />

            {/* Floating Icons */}
            <FloatingIcon icon="account_balance_wallet" className="top-[15%] left-[8%] auth-float-1" />
            <FloatingIcon icon="bar_chart" className="top-[25%] right-[12%] auth-float-2" />
            <FloatingIcon icon="credit_card" className="bottom-[20%] left-[15%] auth-float-3" />
            <FloatingIcon icon="rocket_launch" className="bottom-[35%] right-[8%] auth-float-1" />

            {/* Left Panel — Feature Showcase (desktop only) */}
            <div className="hidden lg:flex flex-col justify-center w-[45%] px-16 py-12 relative z-10">
                <div className="auth-reveal auth-reveal-1">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/30">
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
                        Start building
                        <br />
                        <span className="text-gradient-animated">your wealth today.</span>
                    </h1>
                    <p className="text-white/50 text-base max-w-md leading-relaxed mb-10">
                        Join thousands of people who use AI to make smarter financial decisions every day.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 auth-reveal auth-reveal-3">
                    {[
                        { value: '10K+', label: 'Users' },
                        { value: '₹50M+', label: 'Tracked' },
                        { value: '4.9★', label: 'Rating' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center auth-feature-float">
                            <p className="text-xl font-black text-white">{stat.value}</p>
                            <p className="text-xs text-white/40 font-medium mt-0.5">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel — Register Form */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-6 auth-reveal auth-reveal-1">
                        <div className="inline-flex items-center justify-center mb-4">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/30">
                                <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center p-2">
                                    <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={56} height={56} className="object-contain rounded-xl" />
                                </div>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-white">Create Account</h1>
                        <p className="text-white/50 mt-2 text-sm">Start managing your finances with AI</p>
                    </div>

                    {/* Progress dots */}
                    <div className="flex items-center justify-center gap-2 mb-6 auth-reveal auth-reveal-1">
                        {[0, 1, 2, 3].map(i => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? 'bg-emerald-500 w-8' : 'bg-white/10 w-3'}`}
                            />
                        ))}
                    </div>

                    {/* Form Card */}
                    <div className="auth-card-glow auth-shimmer auth-reveal auth-reveal-2 rounded-3xl overflow-hidden">
                        <div className="card-glass rounded-3xl p-8 sm:p-10">
                            <div className="hidden lg:block mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h2>
                                <p className="text-sm text-gray-500 dark:text-white/40 mt-1">It takes less than a minute</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-xl p-3.5 flex items-start gap-2 animate-fade-in">
                                        <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-white/70">Full Name</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 text-lg transition-colors group-focus-within:text-primary">person</span>
                                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                            className="auth-input w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                                            placeholder="John Doe" required autoComplete="name" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-white/70">Email</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 text-lg transition-colors group-focus-within:text-primary">mail</span>
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                            className="auth-input w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                                            placeholder="you@example.com" required autoComplete="email" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-white/70">Password</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 text-lg transition-colors group-focus-within:text-primary">lock</span>
                                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                                            className="auth-input w-full pl-12 pr-12 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                                            placeholder="••••••••" required minLength={6} />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                    <PasswordStrength password={password} />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-white/70">Confirm Password</label>
                                    <div className="relative group">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 text-lg transition-colors group-focus-within:text-primary">lock_reset</span>
                                        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                                            className="auth-input w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                                            placeholder="••••••••" required minLength={6} />
                                        {confirm && password && (
                                            <span className={`absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-lg transition-colors ${confirm === password ? 'text-emerald-500' : 'text-red-400'}`}
                                                style={{ fontVariationSettings: "'FILL' 1" }}>
                                                {confirm === password ? 'check_circle' : 'cancel'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button type="submit" disabled={loading}
                                    className="w-full py-4 px-4 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 select-none mt-2 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Creating Account...
                                        </div>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            Create Account
                                            <span className="material-symbols-outlined text-lg">rocket_launch</span>
                                        </span>
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <p className="text-sm text-gray-500 dark:text-white/40">
                                    Already have an account?{' '}
                                    <a href="/login" onClick={(e) => { e.preventDefault(); router.push('/login'); }} className="text-primary font-semibold hover:underline transition-colors">
                                        Sign in
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Trust badges */}
                    <div className="auth-reveal auth-reveal-4 mt-6 flex items-center justify-center gap-6 text-white/25 text-xs">
                        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">verified_user</span> Free Forever</span>
                        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">shield</span> No Credit Card</span>
                        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">lock</span> Private</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
