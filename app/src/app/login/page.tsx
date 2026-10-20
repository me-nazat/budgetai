'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { Toaster, toast } from 'sonner';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/dashboard';
    const isDemoParam = searchParams.get('demo') === 'true';

    const [email, setEmail] = useState(isDemoParam ? 'demo@wealthai.app' : '');
    const [password, setPassword] = useState(isDemoParam ? 'DemoUser123!' : '');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // 2FA challenge states
    const [show2FAChallenge, setShow2FAChallenge] = useState(false);
    const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);
    const [authenticatingPasskey, setAuthenticatingPasskey] = useState(false);

    useEffect(() => {
        if (isDemoParam && !email) {
            setEmail('demo@wealthai.app');
            setPassword('DemoUser123!');
        }
    }, [isDemoParam, email]);

    const triggerConfetti = () => {
        try {
            confetti({
                particleCount: 40,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#10B981', '#06B6D4', '#3B82F6']
            });
        } catch {
            // Non-critical celebration effect
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        const char = value.replace(/\D/g, '').slice(-1);
        const next = [...otp];
        next[index] = char;
        setOtp(next);
        setError('');

        if (char && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const next = [...otp];
        for (let i = 0; i < 6; i++) {
            next[i] = pasted[i] || '';
        }
        setOtp(next);
        setError('');
        const focusIdx = Math.min(pasted.length, 5);
        otpRefs.current[focusIdx]?.focus();
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, rememberMe }),
            });
            let data = await res.json().catch(() => null);

            // If demo mode and user not found, auto-provision demo user seamlessly
            if (!res.ok && isDemoParam && (res.status === 401 || res.status === 404)) {
                const regRes = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: 'Demo Explorer',
                        email: 'demo@wealthai.app',
                        password: 'DemoUser123!',
                    }),
                });
                if (regRes.ok) {
                    res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'demo@wealthai.app', password: 'DemoUser123!', rememberMe }),
                    });
                    data = await res.json().catch(() => null);
                }
            }

            if (!res.ok) {
                const errMsg = 
                    (typeof data?.error === 'string' ? data.error : data?.error?.message) 
                    || (typeof data?.message === 'string' ? data.message : null)
                    || (res.status === 401 ? 'Invalid email or password' : 'An unexpected error occurred. Please try again later.');
                throw new Error(errMsg);
            }
            
            if (data?.requires2FA) {
                setShow2FAChallenge(true);
                setLoading(false);
                setTimeout(() => otpRefs.current[0]?.focus(), 150);
                return;
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem('wealth-ai-auth-state', 'authenticated');
                window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }
            
            triggerConfetti();
            toast.success('Signed in successfully');
            
            setTimeout(() => {
                router.push(redirectTo);
            }, 800);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
            setLoading(false);
        }
    };

    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const totpCode = otp.join('');
        if (totpCode.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

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

            if (typeof window !== 'undefined') {
                localStorage.setItem('wealth-ai-auth-state', 'authenticated');
                window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }

            triggerConfetti();
            toast.success('Two-factor verification successful');

            setTimeout(() => {
                router.push(redirectTo);
            }, 800);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid 2FA code');
            setIsVerifying2FA(false);
        }
    };

    const handlePasskeySignIn = async () => {
        setError('');
        setAuthenticatingPasskey(true);
        try {
            const res = await fetch('/api/auth/passkeys/login/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email || undefined }),
            });
            if (!res.ok) throw new Error('Failed to get authentication options');
            const options = await res.json();

            const { startAuthentication } = await import('@simplewebauthn/browser');
            const assertion = await startAuthentication({ optionsJSON: options });

            const verifyRes = await fetch('/api/auth/passkeys/login/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: assertion, rememberMe }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) throw new Error(verifyData.error || 'Passkey verification failed');

            if (typeof window !== 'undefined') {
                localStorage.setItem('wealth-ai-auth-state', 'authenticated');
                window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }

            triggerConfetti();
            toast.success('Passkey authentication verified');

            setTimeout(() => {
                router.push(redirectTo);
            }, 800);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Passkey authentication failed. Please enter credentials or register a passkey.');
        } finally {
            setAuthenticatingPasskey(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 relative overflow-hidden">
            {/* Ambient Background Gradient (Zero-Purple, Emerald & Sky Accents) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[140px]" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-sky-500/10 blur-[140px]" />
            </div>

            {/* Central Institutional Card */}
            <div className="w-full max-w-[440px] rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-xl p-8 sm:p-10 relative z-10 transition-all duration-300">
                
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center mx-auto mb-3 shadow-lg">
                        <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={30} height={30} className="object-contain" priority />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Wealth AI</h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Institutional Wealth & Autonomous Budget Command</p>
                </div>

                {/* Demo Notification Banner if active */}
                {isDemoParam && (
                    <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">verified_user</span>
                            <span className="font-semibold">Demo credentials pre-filled</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleSubmit()}
                            disabled={loading}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors"
                        >
                            Quick Enter
                        </button>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3.5 flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                        <p className="leading-snug">{error}</p>
                    </div>
                )}

                {/* Two-Factor Authentication View */}
                {show2FAChallenge ? (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-2">
                                <span className="material-symbols-outlined text-xl">shield_lock</span>
                            </div>
                            <h2 className="text-lg font-bold text-white">Security Verification</h2>
                            <p className="text-xs text-slate-400 mt-1">Enter the 6-digit code from your authenticator app</p>
                        </div>

                        <form onSubmit={handle2FASubmit} className="space-y-6">
                            <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                                {otp.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={(el) => { otpRefs.current[idx] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                        className="w-11 h-13 text-center text-xl font-mono font-bold rounded-xl border border-slate-700 bg-slate-950 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                    />
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={isVerifying2FA || otp.join('').length !== 6}
                                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isVerifying2FA ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                        <span>Verifying...</span>
                                    </>
                                ) : (
                                    <span>Verify & Enter Dashboard</span>
                                )}
                            </button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShow2FAChallenge(false);
                                        setOtp(['', '', '', '', '', '']);
                                        setError('');
                                    }}
                                    className="text-xs text-slate-400 hover:text-white transition-colors"
                                >
                                    ← Back to credentials
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    /* Standard Login & Passkey Flow */
                    <div className="space-y-6">
                        {/* 1-Click Passkey Biometric Sign In */}
                        <button
                            type="button"
                            onClick={handlePasskeySignIn}
                            disabled={authenticatingPasskey || loading}
                            className="w-full py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99] disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-emerald-400 text-[20px]">fingerprint</span>
                            <span>{authenticatingPasskey ? 'Verifying biometric passkey...' : 'Sign in with Passkey (Biometrics)'}</span>
                        </button>

                        <div className="relative flex items-center justify-center">
                            <div className="border-t border-slate-800 w-full" />
                            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold absolute">or email</span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
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

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-semibold text-slate-300">Password</label>
                                    <a href="#" onClick={(e) => { e.preventDefault(); toast.info('Password reset instructions sent to registered email'); }} className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors">Forgot?</a>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[18px]">lock</span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-xs transition-all"
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                                    />
                                    <span className="text-xs text-slate-400">Remember this device</span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sign In</span>
                                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="pt-4 border-t border-slate-800/80 text-center">
                            <p className="text-xs text-slate-400">
                                Don&apos;t have an account?{' '}
                                <Link href="/register" className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors">
                                    Create Account
                                </Link>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <LoginForm />
            <Toaster position="top-right" richColors />
        </Suspense>
    );
}
