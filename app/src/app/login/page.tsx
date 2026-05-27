'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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
        <div className="min-h-screen flex bg-gray-50 dark:bg-[#0b0f19] transition-colors duration-500">
            {/* Left Panel - Brand Showcase (Hidden on Mobile) */}
            <div className="hidden lg:flex flex-col justify-between w-[45%] max-w-[600px] p-12 bg-white dark:bg-[#111827] border-r border-gray-200 dark:border-white/5 relative overflow-hidden transition-colors duration-500">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent rounded-bl-full pointer-events-none transition-opacity duration-1000 dark:opacity-20 opacity-60" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-500/10 via-cyan-500/5 to-transparent rounded-tr-full pointer-events-none transition-opacity duration-1000 dark:opacity-20 opacity-60" />

                <div className="relative z-10 flex items-center gap-3 animate-fade-in-up">
                    <div className="w-12 h-12 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center shadow-lg">
                        <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={32} height={32} className="object-contain filter invert dark:invert-0" />
                    </div>
                    <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Wealth AI</span>
                </div>

                <div className="relative z-10 mt-auto mb-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <h1 className="text-4xl xl:text-5xl font-black text-gray-900 dark:text-white leading-[1.15] tracking-tight mb-6">
                        Take control of your <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-500">financial future.</span>
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-lg max-w-md leading-relaxed">
                        The intelligent, minimalist platform to track, budget, and grow your wealth. Experience clarity in every transaction.
                    </p>
                </div>

                <div className="relative z-10 flex items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-500 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">security</span> Bank-Grade Security</span>
                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">bolt</span> Real-time Sync</span>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-24 xl:px-32 relative z-10">
                {/* Mobile Header */}
                <div className="lg:hidden flex flex-col items-center mb-10 animate-fade-in-up">
                    <div className="w-16 h-16 rounded-2xl bg-gray-900 dark:bg-white flex items-center justify-center shadow-lg mb-4">
                        <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={40} height={40} className="object-contain filter invert dark:invert-0" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Wealth AI</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Sign in to your account</p>
                </div>

                <div className="w-full max-w-[440px] mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <div className="hidden lg:block mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Welcome back</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Please enter your details to sign in.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-xl p-4 flex items-start gap-3">
                                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
                                placeholder="Enter your email"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
                                <a href="#" className="text-xs font-semibold text-primary hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Forgot password?</a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 pr-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none mt-4 flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/10 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Don&apos;t have an account?{' '}
                            <Link href="/register" className="text-primary font-bold hover:underline transition-colors">
                                Create an account
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0f19]">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
