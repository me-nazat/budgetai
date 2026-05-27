'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

function PasswordStrength({ password }: { password: string }) {
    const checks = [
        { label: 'Min 6 characters', pass: password.length >= 6 },
        { label: 'Contains a number', pass: /\d/.test(password) },
        { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
        { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
    ];

    const strength = checks.filter(c => c.pass).length;
    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
    const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'][strength];
    const strengthWidth = `${(strength / 4) * 100}%`;

    if (!password) return null;

    return (
        <div className="space-y-3 mt-3 animate-fade-in-up">
            <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: strengthWidth, backgroundColor: strengthColor }}
                    />
                </div>
                <span className="text-xs font-bold" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {checks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`material-symbols-outlined text-[14px] transition-colors duration-300 ${c.pass ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`}
                            style={{ fontVariationSettings: c.pass ? "'FILL' 1" : "'FILL' 0" }}>
                            {c.pass ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={`transition-colors ${c.pass ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'}`}>{c.label}</span>
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

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-[#0b0f19] transition-colors duration-500">
            {/* Left Panel - Brand Showcase (Hidden on Mobile) */}
            <div className="hidden lg:flex flex-col justify-between w-[45%] max-w-[600px] p-12 bg-white dark:bg-[#111827] border-r border-gray-200 dark:border-white/5 relative overflow-hidden transition-colors duration-500">
                {/* Decorative background elements */}
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent rounded-br-full pointer-events-none transition-opacity duration-1000 dark:opacity-20 opacity-60" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-cyan-500/10 via-cyan-500/5 to-transparent rounded-tl-full pointer-events-none transition-opacity duration-1000 dark:opacity-20 opacity-60" />

                <div className="relative z-10 flex items-center gap-3 animate-fade-in-up">
                    <div className="w-12 h-12 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center shadow-lg">
                        <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={32} height={32} className="object-contain filter invert dark:invert-0" />
                    </div>
                    <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Wealth AI</span>
                </div>

                <div className="relative z-10 mt-auto mb-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <h1 className="text-4xl xl:text-5xl font-black text-gray-900 dark:text-white leading-[1.15] tracking-tight mb-6">
                        Start building your <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">wealth today.</span>
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-lg max-w-md leading-relaxed mb-8">
                        Join thousands of people who use AI to make smarter financial decisions every day.
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-6">
                        {[
                            { value: '10K+', label: 'Active Users' },
                            { value: '$50M+', label: 'Tracked' },
                            { value: '4.9★', label: 'App Rating' },
                        ].map((stat, i) => (
                            <div key={i} className="border-l-2 border-gray-200 dark:border-white/10 pl-4">
                                <p className="text-xl font-black text-gray-900 dark:text-white">{stat.value}</p>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mt-1">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 flex items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-500 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">security</span> Safe & Secure</span>
                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">verified</span> Free Forever</span>
                </div>
            </div>

            {/* Right Panel - Register Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-24 xl:px-32 relative z-10 overflow-y-auto py-12">
                {/* Mobile Header */}
                <div className="lg:hidden flex flex-col items-center mb-8 animate-fade-in-up">
                    <div className="w-16 h-16 rounded-2xl bg-gray-900 dark:bg-white flex items-center justify-center shadow-lg mb-4">
                        <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={40} height={40} className="object-contain filter invert dark:invert-0" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Create Account</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Start managing your finances</p>
                </div>

                <div className="w-full max-w-[440px] mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <div className="hidden lg:block mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Create an account</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">It takes less than a minute to get started.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-xl p-4 flex items-start gap-3">
                                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                                placeholder="John Doe"
                                required
                                autoComplete="name"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 pr-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                            <PasswordStrength password={password} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Confirm Password</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    className="w-full px-4 py-3.5 pr-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                                {confirm && password && (
                                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] transition-colors ${confirm === password ? 'text-emerald-500' : 'text-red-400'}`}
                                        style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {confirm === password ? 'check_circle' : 'cancel'}
                                    </span>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || (password !== confirm && confirm !== '')}
                            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none mt-6 flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Creating Account...</span>
                                </>
                            ) : (
                                <>
                                    <span>Create Account</span>
                                    <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/10 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Already have an account?{' '}
                            <Link href="/login" className="text-emerald-600 font-bold hover:underline transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
