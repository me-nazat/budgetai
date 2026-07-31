'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { Toaster, toast } from 'sonner';

const testimonials = [
  {
    quote: "Wealth AI completely changed how I manage my money. The insights are incredibly accurate.",
    author: "Sarah J.",
    role: "Freelance Designer"
  },
  {
    quote: "The interface is so clean and the AI categorization saves me hours every month.",
    author: "Michael T.",
    role: "Small Business Owner"
  },
  {
    quote: "I finally have clarity on my spending habits. Worth every penny.",
    author: "Elena R.",
    role: "Software Engineer"
  }
];

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [activeTestimonial, setActiveTestimonial] = useState(0);

    // 2FA challenge states
    const [show2FAChallenge, setShow2FAChallenge] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);
    const [authenticatingPasskey, setAuthenticatingPasskey] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

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
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, rememberMe }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const errMsg = 
                    (typeof data?.error === 'string' ? data.error : data?.error?.message) 
                    || (typeof data?.message === 'string' ? data.message : null)
                    || (res.status === 401 ? 'Invalid email or password' : 'An unexpected error occurred. Please try again later.');
                throw new Error(errMsg);
            }
            
            if (data.requires2FA) {
                setShow2FAChallenge(true);
                setLoading(false);
                return;
            }

            // Signal successful authentication for cache warming
            if (typeof window !== 'undefined') {
              localStorage.setItem('wealth-ai-auth-state', 'authenticated');
              window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }
            
            triggerConfetti();
            
            setTimeout(() => {
                router.push(redirectTo);
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            setLoading(false);
        }
    };

    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsVerifying2FA(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, rememberMe, totpCode }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const errMsg = data?.error?.message 
                    || (typeof data?.error === 'string' ? data.error : data?.message)
                    || 'Invalid 2FA code';
                throw new Error(errMsg);
            }

            // Signal successful authentication for cache warming
            if (typeof window !== 'undefined') {
              localStorage.setItem('wealth-ai-auth-state', 'authenticated');
              window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }

            triggerConfetti();

            setTimeout(() => {
                router.push(redirectTo);
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid 2FA code');
            setIsVerifying2FA(false);
        }
    };

    const handlePasskeySignIn = async () => {
        setError('');
        setAuthenticatingPasskey(true);
        try {
            // Options generation
            const res = await fetch('/api/auth/passkeys/login/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email || undefined }),
            });
            if (!res.ok) throw new Error('Failed to get authentication options');
            const options = await res.json();

            // Client authentication
            const { startAuthentication } = await import('@simplewebauthn/browser');
            const assertion = await startAuthentication({ optionsJSON: options });

            // Verification
            const verifyRes = await fetch('/api/auth/passkeys/login/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: assertion, rememberMe }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) throw new Error(verifyData.error || 'Passkey verification failed');

            // Signal successful authentication for cache warming
            if (typeof window !== 'undefined') {
              localStorage.setItem('wealth-ai-auth-state', 'authenticated');
              window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }

            triggerConfetti();

            setTimeout(() => {
                router.push(redirectTo);
            }, 1500);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Passkey authentication failed. Make sure you are using a registered passkey on a secure origin.');
        } finally {
            setAuthenticatingPasskey(false);
        }
    };

    return (
        <div className="min-h-screen flex animated-mesh-bg transition-colors duration-500 overflow-hidden relative">
            {/* Animated Mesh Gradient Background is handled by .animated-mesh-bg */}
            <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/30 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/30 blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
                <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-emerald-500/20 blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '1s' }} />
            </div>

            {/* Split Layout */}
            <div className="flex w-full z-10 relative">
                
                {/* Left Panel - Testimonial/Feature Carousel */}
                <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 text-gray-900 dark:text-white">
                    <div className="flex items-center gap-3 animate-fade-in-up">
                        <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/20">
                            <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={32} height={32} className="object-contain filter invert-0" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Wealth AI</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <h1 className="text-5xl font-black leading-tight mb-8 text-gray-900 dark:text-white">
                            Master your money,<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-950 to-cyan-950 dark:from-emerald-400 dark:to-cyan-400">effortlessly.</span>
                        </h1>
                        
                        {/* Carousel */}
                        <div className="relative h-40">
                            {testimonials.map((test, idx) => (
                                <div 
                                    key={idx}
                                    className={`absolute top-0 left-0 transition-all duration-700 ${idx === activeTestimonial ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
                                >
                                    <p className="text-xl text-gray-700 dark:text-gray-300 italic mb-4">"{test.quote}"</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center font-bold text-sm text-white">
                                            {test.author.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{test.author}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{test.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                            {testimonials.map((_, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => setActiveTestimonial(idx)}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeTestimonial ? 'w-8 bg-primary' : 'w-2 bg-gray-600'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Glass Form */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
                    
                    {/* Floating Icons */}
                    <div className="hidden sm:block absolute inset-0 pointer-events-none">
                        <div className="auth-floating-icon w-16 h-16 top-[15%] right-[10%]" style={{ animationDelay: '0s' }}>
                            <span className="material-symbols-outlined text-3xl text-emerald-400">payments</span>
                        </div>
                        <div className="auth-floating-icon w-14 h-14 bottom-[20%] right-[85%]" style={{ animationDelay: '-5s', animationDuration: '18s' }}>
                            <span className="material-symbols-outlined text-2xl text-blue-400">insights</span>
                        </div>
                        <div className="auth-floating-icon w-12 h-12 bottom-[15%] right-[20%]" style={{ animationDelay: '-10s', animationDuration: '12s' }}>
                            <span className="material-symbols-outlined text-xl text-cyan-400">account_balance_wallet</span>
                        </div>
                    </div>

                    <div className="auth-glass-card w-full max-w-[480px] p-8 sm:p-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                        {show2FAChallenge ? (
                            <>
                                <div className="mb-10 text-center">
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Security Verification</h2>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">Enter the 6-digit code from your authenticator app.</p>
                                </div>

                                <form onSubmit={handle2FASubmit} className="space-y-6">
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                                            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                                            <p>{error}</p>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 relative group">
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Verification Code</label>
                                        <input
                                            type="text"
                                            value={totpCode}
                                            onChange={(e) => setTotpCode(e.target.value)}
                                            placeholder="000000"
                                            maxLength={6}
                                            required
                                            className="w-full text-center px-4 py-3.5 rounded-xl font-mono text-lg tracking-[0.5rem] border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isVerifying2FA || totpCode.length !== 6}
                                        className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-cyan-500 px-4 py-4 font-bold text-gray-900 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-70 group w-full"
                                    >
                                        {isVerifying2FA ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                                                <span>Verifying...</span>
                                            </>
                                        ) : (
                                            <span>Verify & Sign In</span>
                                        )}
                                    </button>

                                    <div className="text-center pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShow2FAChallenge(false);
                                                setTotpCode('');
                                                setError('');
                                            }}
                                            className="text-xs font-semibold text-primary hover:text-emerald-400 transition-colors"
                                        >
                                            Back to Login
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <>
                                <div className="mb-10 text-center">
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Welcome Back</h2>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">Enter your credentials or use a registered passkey.</p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                                            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                                            <p>{error}</p>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 relative group">
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-focus-within:text-primary group-focus-within:-translate-y-1 transition-all">Email Address</label>
                                        <div className="relative auth-input-focus">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 group-focus-within:text-primary transition-colors">mail</span>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner"
                                                placeholder="you@example.com"
                                                required
                                                autoComplete="email"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 relative group">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-focus-within:text-primary group-focus-within:-translate-y-1 transition-all">Password</label>
                                            <a href="#" className="text-xs font-semibold text-primary hover:text-emerald-400 transition-colors">Forgot?</a>
                                        </div>
                                        <div className="relative auth-input-focus">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 group-focus-within:text-primary transition-colors">lock</span>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner"
                                                placeholder="••••••••"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 pt-2">
                                        <div className="flex items-center gap-2.5 select-none">
                                            <input
                                                type="checkbox"
                                                id="rememberMe"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="h-4 w-4 cursor-pointer rounded border-gray-300 bg-gray-50 text-primary transition-colors focus:ring-primary focus:ring-opacity-50 dark:border-white/10 dark:bg-white/5"
                                                aria-describedby="rememberMe-desc"
                                            />
                                            <label htmlFor="rememberMe" id="rememberMe-desc" className="cursor-pointer text-xs font-semibold text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300">
                                                Remember This Device
                                            </label>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={handlePasskeySignIn}
                                                disabled={authenticatingPasskey || loading}
                                                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-white/10 bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 px-4 py-4 text-xs font-bold text-gray-900 dark:text-white transition-all outline-none"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                                                <span>{authenticatingPasskey ? 'Verifying...' : 'Use Passkey'}</span>
                                            </button>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="relative flex-1 flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-cyan-500 px-4 py-4 font-bold text-gray-900 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:from-emerald-400 hover:to-cyan-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-70 group"
                                            >
                                                <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-[shimmer_1s_forwards]" />
                                                
                                                {loading ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                                                        <span>Authenticating...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>Sign In</span>
                                                        <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </form>

                                <div className="mt-8 pt-8 border-t border-white/10 text-center">
                                    <p className="text-sm text-gray-400">
                                        Don&apos;t have an account?{' '}
                                        <Link href="/register" className="text-gray-900 dark:text-white font-bold hover:text-primary transition-colors relative group">
                                            Create an account
                                            <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-primary transition-all group-hover:w-full" />
                                        </Link>
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Tailwind Keyframes directly added to avoid needing extra CSS */}
            <style jsx global>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0E1B]">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <LoginForm />
            <Toaster position="top-right" richColors />
        </Suspense>
    );
}
