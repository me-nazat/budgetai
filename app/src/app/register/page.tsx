'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { Toaster, toast } from 'sonner';

function PasswordStrength({ password }: { password: string }) {
    const checks = [
        { label: 'Min 6 characters', pass: password.length >= 6 },
        { label: 'Contains number', pass: /\d/.test(password) },
        { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
        { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
    ];

    const score = checks.filter(c => c.pass).length;
    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][score];
    const strengthColor = ['', '#f43f5e', '#f59e0b', '#38bdf8', '#10b981'][score];
    const strengthWidth = `${(score / 4) * 100}%`;

    if (!password) return null;

    return (
        <div className="space-y-2 mt-2.5">
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: strengthWidth, backgroundColor: strengthColor }}
                    />
                </div>
                <span className="text-[11px] font-bold" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
                {checks.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px]">
                        <span
                            className={`material-symbols-outlined text-[13px] ${c.pass ? 'text-emerald-400' : 'text-slate-600'}`}
                            style={{ fontVariationSettings: c.pass ? "'FILL' 1" : "'FILL' 0" }}
                        >
                            {c.pass ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={c.pass ? 'text-slate-300 font-medium' : 'text-slate-500'}>{c.label}</span>
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
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [detectedCurrency, setDetectedCurrency] = useState('BDT');
    const [detectedTimezone, setDetectedTimezone] = useState('UTC');

    useEffect(() => {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            setDetectedTimezone(tz);
            const curr = tz === 'Asia/Dhaka' ? 'BDT' : 'USD';
            setDetectedCurrency(curr);
        } catch {
            // Default to BDT for Bangladesh or USD
            setDetectedCurrency('BDT');
        }
    }, []);

    const triggerConfetti = () => {
        try {
            confetti({
                particleCount: 50,
                spread: 70,
                origin: { y: 0.7 },
                colors: ['#10B981', '#06B6D4', '#3B82F6']
            });
        } catch {
            // Non-critical celebration effect
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error?.message || (typeof data?.error === 'string' ? data.error : 'Registration failed'));
            }

            // Persist detected regional preferences
            if (typeof window !== 'undefined') {
                localStorage.setItem('wealth-ai-currency', detectedCurrency);
                localStorage.setItem('wealth-ai-timezone', detectedTimezone);
                localStorage.setItem('wealth-ai-auth-state', 'authenticated');
                window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }

            // Attempt to update user base currency in background if needed
            fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currency: detectedCurrency }),
            }).catch(() => {});

            triggerConfetti();
            toast.success('Account created! Welcome to Wealth AI.');

            setTimeout(() => {
                router.push('/dashboard');
            }, 800);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 relative overflow-hidden">
            {/* Ambient Lighting Accents (Sovereign Navy) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[140px]" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-sky-500/10 blur-[140px]" />
            </div>

            {/* Central Institutional Card */}
            <div className="w-full max-w-[440px] rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-xl p-8 sm:p-10 relative z-10 transition-all duration-300">
                
                {/* Brand Header */}
                <div className="text-center mb-7">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center mx-auto mb-3 shadow-lg">
                        <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={30} height={30} className="object-contain" priority />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Create Account</h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Get started with your autonomous financial vault</p>
                </div>

                {/* Regional Auto-Detection Pill */}
                <div className="mb-6 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-400 text-[15px]">public</span>
                        <span>Region: {detectedTimezone}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {detectedCurrency}
                    </span>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3.5 flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                        <p className="leading-snug">{error}</p>
                    </div>
                )}

                {/* 3-Field Streamlined Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Field 1: Full Name */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">Full Name</label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[18px]">person</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all"
                                placeholder="Your full name"
                                required
                                autoComplete="name"
                            />
                        </div>
                    </div>

                    {/* Field 2: Email Address */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">Email Address</label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[18px]">mail</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all"
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Field 3: Password */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">Password</label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[18px]">lock</span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all"
                                placeholder="••••••••"
                                required
                                minLength={6}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                        <PasswordStrength password={password} />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-5"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                <span>Creating Account...</span>
                            </>
                        ) : (
                            <>
                                <span>Launch 60-Second Setup</span>
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
                    <p className="text-xs text-slate-400">
                        Already have an account?{' '}
                        <Link href="/login" className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
            <Toaster position="top-right" richColors />
        </div>
    );
}
