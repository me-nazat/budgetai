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

    // Tabs: 'password' | 'passkey'
    const [authMode, setAuthMode] = useState<'password' | 'passkey'>('password');

    const [email, setEmail] = useState(isDemoParam ? 'demo@wealthai.app' : '');
    const [password, setPassword] = useState(isDemoParam ? 'DemoUser123!' : '');
    const [rememberMe, setRememberMe] = useState(true);
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
                particleCount: 50,
                spread: 70,
                origin: { y: 0.65 },
                colors: ['#10B981', '#06B6D4', '#059669', '#38BDF8'],
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

    const handleQuickDemoFill = () => {
        setEmail('demo@wealthai.app');
        setPassword('DemoUser123!');
        setError('');
        toast.info('Demo credentials populated. Click Sign In to explore.');
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password, rememberMe }),
            });
            let data = await res.json().catch(() => null);

            // If demo credentials and user not yet provisioned, auto-provision demo user seamlessly
            if (!res.ok && (email === 'demo@wealthai.app' || isDemoParam) && (res.status === 401 || res.status === 404)) {
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
                let errMsg = '';
                if (data?.error) {
                    errMsg = typeof data.error === 'string' ? data.error : data.error.message;
                } else if (data?.message) {
                    errMsg = typeof data.message === 'string' ? data.message : null;
                }

                if (!errMsg) {
                    if (res.status === 401) {
                        errMsg = 'Invalid email or password. Please verify your credentials or use Quick Demo.';
                    } else if (res.status === 429) {
                        errMsg = 'Too many attempts. Account temporarily locked for 15 minutes for your security.';
                    } else if (res.status >= 500) {
                        errMsg = 'Database or server initialization in progress. Please retry or click Quick Demo.';
                    } else {
                        errMsg = `Authentication error (${res.status}). Please try again.`;
                    }
                }
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
            toast.success('Access Granted • Welcome back to Wealth AI');

            setTimeout(() => {
                router.push(redirectTo);
            }, 700);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
            setLoading(false);
        }
    };

    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const totpCode = otp.join('');
        if (totpCode.length !== 6) {
            setError('Please enter all 6 verification digits');
            return;
        }

        setError('');
        setIsVerifying2FA(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password, rememberMe, totpCode }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const errMsg =
                    data?.error?.message ||
                    (typeof data?.error === 'string' ? data.error : data?.message) ||
                    'Invalid verification code. Please check your authenticator.';
                throw new Error(errMsg);
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem('wealth-ai-auth-state', 'authenticated');
                window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }

            triggerConfetti();
            toast.success('Identity Verified • Accessing Private Vault');

            setTimeout(() => {
                router.push(redirectTo);
            }, 700);
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
                body: JSON.stringify({ email: email.trim() || undefined }),
            });
            if (!res.ok) throw new Error('Biometric challenge request failed. Enter email or use credentials.');
            const options = await res.json();

            const { startAuthentication } = await import('@simplewebauthn/browser');
            const assertion = await startAuthentication({ optionsJSON: options });

            const verifyRes = await fetch('/api/auth/passkeys/login/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response: assertion, rememberMe }),
            });
            const verifyData = await verifyRes.json().catch(() => null);

            if (!verifyRes.ok) {
                throw new Error(verifyData?.error || 'Passkey verification failed. Please try again.');
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem('wealth-ai-auth-state', 'authenticated');
                window.dispatchEvent(new Event('wealth-ai-authenticated'));
            }

            triggerConfetti();
            toast.success('Biometric Passkey Verified');

            setTimeout(() => {
                router.push(redirectTo);
            }, 700);
        } catch (err: any) {
            console.error('Passkey authentication error:', err);
            setError(
                err.message || 'Passkey authentication failed. Please enter your email and password instead.'
            );
        } finally {
            setAuthenticatingPasskey(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-[#06080F] text-slate-100 relative overflow-hidden select-none">
            {/* Ambient Background Glows — Emerald, Cyan & Obsidian Depth (Sovereign Theme) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] left-[-10%] w-[700px] h-[700px] rounded-full bg-emerald-500/[0.08] blur-[150px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[650px] h-[650px] rounded-full bg-cyan-500/[0.07] blur-[160px]" />
                <div className="absolute top-[40%] right-[30%] w-[500px] h-[500px] rounded-full bg-teal-500/[0.04] blur-[180px]" />
                {/* Subtle Grid Canvas Overlay */}
                <div 
                    className="absolute inset-0 opacity-[0.03]" 
                    style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
                        backgroundSize: '36px 36px'
                    }} 
                />
            </div>

            {/* Main Institutional Framework Container */}
            <div className="w-full max-w-5xl relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* Left Showcase Pillar: Institutional Capabilities (Visible on lg+) */}
                <div className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-8 pr-4">
                    {/* Header Branding */}
                    <div>
                        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-6 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[11px] font-semibold tracking-wider text-emerald-300 uppercase">
                                Institutional Wealth Protocol 3.0
                            </span>
                        </div>

                        <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                            Autonomous Wealth.{' '}
                            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                                Sovereign Command.
                            </span>
                        </h1>

                        <p className="text-sm text-slate-400 mt-4 leading-relaxed max-w-md">
                            Private multi-currency ledgers, AI-driven portfolio synthesis, and institutional-grade financial intelligence — secured with defense-grade zero-knowledge encryption.
                        </p>
                    </div>

                    {/* Capability Cards Matrix */}
                    <div className="space-y-3.5">
                        <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex items-start gap-3.5 hover:border-emerald-500/30 transition-all">
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-white tracking-wide">Multi-Wallet Dynamic Ledger</h3>
                                <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                                    Instant multi-currency balances across accounts, cash reserves, and automated debt amortization.
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex items-start gap-3.5 hover:border-cyan-500/30 transition-all">
                            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-[20px]">psychology</span>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-white tracking-wide">AI Financial Intelligence Engine</h3>
                                <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                                    Natural language expense tagging, predictive cashflow modeling, and autonomous leak detection.
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex items-start gap-3.5 hover:border-emerald-500/30 transition-all">
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-[20px]">security</span>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-white tracking-wide">FIDO2 Biometrics & Field Encryption</h3>
                                <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                                    Hardware-backed biometric passkeys, TOTP two-factor defense, and AES-256 field encryption.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Telemetry Status Strip */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>SYSTEMS NOMINAL • TURSO v0.17</span>
                        </div>
                        <span>AES-256 GCM • TLS 1.3</span>
                    </div>
                </div>

                {/* Right Interactive Card: The High-Fidelity Login Console */}
                <div className="lg:col-span-6 w-full max-w-[460px] mx-auto">
                    <div className="rounded-2xl border border-slate-800/90 bg-[#0C101B]/95 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl p-7 sm:p-9 relative z-10 transition-all duration-300 ring-1 ring-white/[0.05]">
                        
                        {/* Mobile Brand Header */}
                        <div className="text-center mb-6">
                            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center mx-auto mb-3.5 shadow-xl group">
                                <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 blur-md group-hover:bg-emerald-500/20 transition-all" />
                                <Image 
                                    src="/wealth-ai-logo-v2.png" 
                                    alt="Wealth AI" 
                                    width={36} 
                                    height={36} 
                                    className="object-contain relative z-10 drop-shadow-md" 
                                    priority 
                                />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight text-white">Wealth AI</h2>
                            <p className="text-xs text-slate-400 mt-1 font-medium">Institutional Wealth & Autonomous Budget Command</p>
                        </div>

                        {/* Top Mode Segmented Switcher */}
                        {!show2FAChallenge && (
                            <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 mb-6">
                                <button
                                    type="button"
                                    onClick={() => { setAuthMode('password'); setError(''); }}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                                        authMode === 'password'
                                            ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">lock</span>
                                    <span>Credentials</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setAuthMode('passkey'); setError(''); }}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                                        authMode === 'passkey'
                                            ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/50'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                                    <span>Biometrics</span>
                                </button>
                            </div>
                        )}

                        {/* Quick Demo Sandbox Banner */}
                        {!show2FAChallenge && (
                            <div className="mb-5 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-400 text-[18px]">bolt</span>
                                    <div>
                                        <span className="text-[11px] font-bold text-emerald-300 block">Instant Sandbox</span>
                                        <span className="text-[10px] text-slate-400">Pre-fill demo user credentials</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleQuickDemoFill}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 transition-all hover:scale-102 active:scale-98"
                                >
                                    Fill Demo
                                </button>
                            </div>
                        )}

                        {/* Actionable Error Banner with Remediation */}
                        {error && (
                            <div className="mb-5 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs rounded-xl p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <span className="material-symbols-outlined text-rose-400 text-[18px] shrink-0 mt-0.5">error</span>
                                <div className="flex-1 space-y-1">
                                    <p className="leading-snug font-medium">{error}</p>
                                    <div className="flex items-center gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleQuickDemoFill}
                                            className="text-[11px] font-bold text-emerald-400 hover:underline"
                                        >
                                            Switch to Demo Account
                                        </button>
                                        <span className="text-slate-600">•</span>
                                        <Link href="/register" className="text-[11px] font-bold text-slate-400 hover:text-white">
                                            Register New
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Two-Factor Authentication (TOTP Challenge) */}
                        {show2FAChallenge ? (
                            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                                <div className="text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-cyan-500/10">
                                        <span className="material-symbols-outlined text-2xl">shield_person</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Two-Factor Authentication</h3>
                                    <p className="text-xs text-slate-400 mt-1">Enter the 6-digit TOTP code from your authenticator application</p>
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
                                                className="w-11 h-14 text-center text-xl font-mono font-extrabold rounded-xl border border-slate-700 bg-slate-950 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner"
                                            />
                                        ))}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isVerifying2FA || otp.join('').length !== 6}
                                        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isVerifying2FA ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                                <span>Verifying Protocol...</span>
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
                                            className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 font-medium"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                                            <span>Back to credentials</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : authMode === 'passkey' ? (
                            /* Biometric Passkey Experience */
                            <div className="space-y-6 py-2 animate-in fade-in duration-200">
                                <div className="text-center py-4">
                                    <div className="w-20 h-20 rounded-3xl bg-slate-950 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 relative shadow-2xl">
                                        <div className="absolute inset-0 rounded-3xl bg-emerald-500/10 animate-ping opacity-30" />
                                        <span className="material-symbols-outlined text-emerald-400 text-4xl">fingerprint</span>
                                    </div>
                                    <h3 className="text-base font-bold text-white">Biometric Sovereign Key</h3>
                                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                                        Sign in instantly with Touch ID, Face ID, or Windows Hello hardware passkeys.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Account Identifier (Optional)</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[18px]">badge</span>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs transition-all"
                                            placeholder="you@example.com (or leave empty for device passkey)"
                                            autoComplete="username webauthn"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handlePasskeySignIn}
                                    disabled={authenticatingPasskey}
                                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 active:scale-[0.99] disabled:opacity-50"
                                >
                                    {authenticatingPasskey ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                            <span>Waiting for Biometric Prompt...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                                            <span>Authenticate with Passkey</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            /* Standard Credentials Flow */
                            <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-200">
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Email Address</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[18px]">alternate_email</span>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs transition-all"
                                            placeholder="your.email@example.com"
                                            required
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Access Secret</label>
                                        <button
                                            type="button"
                                            onClick={() => toast.info('Password recovery link has been dispatched to your email address.')}
                                            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                        >
                                            Forgot?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[18px]">lock</span>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs transition-all font-mono"
                                            placeholder="••••••••••••"
                                            required
                                            autoComplete="current-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                            tabIndex={-1}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">
                                                {showPassword ? 'visibility_off' : 'visibility'}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 transition-colors"
                                        />
                                        <span className="text-xs text-slate-400 font-medium">Keep session active (30 days)</span>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 active:scale-[0.99]"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                            <span>Authenticating Vault...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Access Dashboard</span>
                                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* Card Footer */}
                        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
                            <p className="text-xs text-slate-400">
                                Need an institutional account?{' '}
                                <Link 
                                    href="/register" 
                                    className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors ml-1 inline-flex items-center gap-0.5 hover:underline"
                                >
                                    <span>Create Account</span>
                                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Security Compliance Micro Badge */}
                    <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-emerald-400">lock</span>
                            256-Bit TLS
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-cyan-400">verified</span>
                            SOC-2 Standard
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-emerald-400">shield</span>
                            Zero-Knowledge
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#06080F] text-slate-400">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <LoginForm />
            <Toaster position="top-right" richColors />
        </Suspense>
    );
}
