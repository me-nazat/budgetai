'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import confetti from 'canvas-confetti';

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
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: strengthWidth, backgroundColor: strengthColor }}
                    />
                </div>
                <span className="text-xs font-bold transition-colors duration-300" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {checks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`material-symbols-outlined text-[14px] transition-all duration-300 ${c.pass ? 'text-emerald-400 scale-110' : 'text-gray-600 scale-100'}`}
                            style={{ fontVariationSettings: c.pass ? "'FILL' 1" : "'FILL' 0" }}>
                            {c.pass ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={`transition-colors duration-300 ${c.pass ? 'text-white' : 'text-gray-500'}`}>{c.label}</span>
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

    const triggerConfetti = () => {
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#10B981', '#06B6D4', '#3B82F6']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#10B981', '#06B6D4', '#3B82F6']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    };

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
            
            triggerConfetti();
            
            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex animated-mesh-bg transition-colors duration-500 overflow-hidden relative">
            {/* Animated Mesh Gradient Background is handled by .animated-mesh-bg */}
            <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '9s' }} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '11s', animationDelay: '2s' }} />
                <div className="absolute top-[50%] left-[50%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[100px] animate-pulse" style={{ animationDuration: '13s', animationDelay: '1s' }} />
            </div>

            {/* Split Layout */}
            <div className="flex w-full z-10 relative">
                
                {/* Left Panel - Feature Highlights (Hidden on Mobile) */}
                <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 text-white">
                    <div className="flex items-center gap-3 animate-fade-in-up">
                        <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/20">
                            <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={32} height={32} className="object-contain filter invert-0" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">Wealth AI</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <h1 className="text-5xl font-black leading-tight mb-6">
                            Start building your<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">wealth today.</span>
                        </h1>
                        <p className="text-gray-300 text-lg max-w-md leading-relaxed mb-12">
                            Join thousands of people who use AI to make smarter financial decisions every single day.
                        </p>

                        <div className="space-y-6">
                            {[
                                { icon: 'auto_awesome', title: 'AI-Powered Insights', desc: 'Get personalized financial advice based on your spending.' },
                                { icon: 'security', title: 'Bank-Grade Security', desc: 'Your data is encrypted and completely secure.' },
                                { icon: 'query_stats', title: 'Advanced Analytics', desc: 'Visualize your wealth growth with interactive charts.' }
                            ].map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-emerald-400">{feature.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold">{feature.title}</h3>
                                        <p className="text-gray-400 text-sm mt-1">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Glass Form */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
                    
                    {/* Floating Icons */}
                    <div className="hidden sm:block absolute inset-0 pointer-events-none">
                        <div className="auth-floating-icon w-14 h-14 top-[10%] right-[15%]" style={{ animationDelay: '-2s' }}>
                            <span className="material-symbols-outlined text-2xl text-emerald-400">savings</span>
                        </div>
                        <div className="auth-floating-icon w-16 h-16 bottom-[15%] right-[80%]" style={{ animationDelay: '-7s', animationDuration: '16s' }}>
                            <span className="material-symbols-outlined text-3xl text-cyan-400">trending_up</span>
                        </div>
                    </div>

                    <div className="auth-glass-card w-full max-w-[480px] p-8 sm:p-12 animate-fade-in-up my-auto" style={{ animationDelay: '0.4s' }}>
                        <div className="mb-8 text-center">
                            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Create Account</h2>
                            <p className="text-gray-400 text-sm">It takes less than a minute to get started.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                                    <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                                    <p>{error}</p>
                                </div>
                            )}

                            <div className="space-y-1.5 relative group">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider group-focus-within:text-emerald-400 group-focus-within:-translate-y-1 transition-all">Full Name</label>
                                <div className="relative auth-input-focus">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 group-focus-within:text-emerald-400 transition-colors">person</span>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all shadow-inner"
                                        placeholder="John Doe"
                                        required
                                        autoComplete="name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 relative group">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider group-focus-within:text-emerald-400 group-focus-within:-translate-y-1 transition-all">Email Address</label>
                                <div className="relative auth-input-focus">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 group-focus-within:text-emerald-400 transition-colors">mail</span>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all shadow-inner"
                                        placeholder="you@example.com"
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 relative group">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider group-focus-within:text-emerald-400 group-focus-within:-translate-y-1 transition-all">Password</label>
                                <div className="relative auth-input-focus">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 group-focus-within:text-emerald-400 transition-colors">lock</span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all shadow-inner"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                                <PasswordStrength password={password} />
                            </div>

                            <div className="space-y-1.5 relative group">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider group-focus-within:text-emerald-400 group-focus-within:-translate-y-1 transition-all">Confirm Password</label>
                                <div className="relative auth-input-focus">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 group-focus-within:text-emerald-400 transition-colors">lock_clock</span>
                                    <input
                                        type="password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all shadow-inner"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                    {confirm && password && (
                                        <span className={`absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] transition-all duration-300 ${confirm === password ? 'text-emerald-400 scale-110' : 'text-red-400 scale-100'}`}
                                            style={{ fontVariationSettings: "'FILL' 1" }}>
                                            {confirm === password ? 'check_circle' : 'cancel'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || (password !== confirm && confirm !== '')}
                                className="relative w-full py-4 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-gray-900 font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-300 disabled:opacity-70 disabled:shadow-none mt-6 flex items-center justify-center gap-2 group overflow-hidden"
                            >
                                {/* Button Glow Effect */}
                                <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-[shimmer_1s_forwards]" />
                                
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                                        <span>Creating Account...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Complete Registration</span>
                                        <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-white/10 text-center">
                            <p className="text-sm text-gray-400">
                                Already have an account?{' '}
                                <Link href="/login" className="text-white font-bold hover:text-emerald-400 transition-colors relative group">
                                    Sign in
                                    <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-emerald-400 transition-all group-hover:w-full" />
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Tailwind Keyframes */}
            <style jsx global>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}
