'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
            if (!res.ok) throw new Error(data.error);
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-bg-light to-blue-50/50 dark:from-[#0B0F19] dark:to-[#111827] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 dark:bg-primary/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-400/20 dark:bg-blue-600/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

            <div className="w-full max-w-md relative z-10 py-8">
                <div className="text-center mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="inline-flex items-center justify-center mb-4">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-blue-600 p-0.5 shadow-lg shadow-primary/30">
                            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center p-2">
                                <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={56} height={56} className="object-contain rounded-xl" />
                            </div>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Account</h1>
                    <p className="text-gray-500 dark:text-text-muted mt-2">Start managing your finances with AI</p>
                </div>

                <div className="card-premium rounded-2xl p-8 sm:p-10 shadow-xl animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg p-3">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-[#111418]/50 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                                placeholder="John Doe" required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-[#111418]/50 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                                placeholder="you@example.com" required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-[#111418]/50 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                                placeholder="••••••••" required minLength={6} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
                            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-[#111418]/50 text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                                placeholder="••••••••" required minLength={6} />
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full py-3.5 px-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 btn-primary-glow select-none mt-2">
                            {loading ? <div className="flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Creating Account...</div> : 'Create Account'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500 dark:text-text-muted">
                            Already have an account?{' '}
                            <a href="/login" onClick={(e) => { e.preventDefault(); router.push('/login'); }} className="text-primary font-medium hover:underline">
                                Sign in
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
