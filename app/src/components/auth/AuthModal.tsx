'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, Fingerprint, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FluidButton } from '@/components/ui/FluidButton';

type AuthStep = 'email' | 'password' | 'passkey' | 'register';

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 100 : -100, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 100 : -100, opacity: 0 }),
};

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<AuthStep>('email');
  const [direction, setDirection] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasskeyScanning, setIsPasskeyScanning] = useState(false);

  const goTo = (newStep: AuthStep, dir: number) => { setDirection(dir); setStep(newStep); };
  const handlePasskey = () => { setIsPasskeyScanning(true); setTimeout(() => setIsPasskeyScanning(false), 2000); };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] flex items-center justify-center p-4" onClick={onClose}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <GlassCard padding="lg" className="relative overflow-hidden">
              <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/[0.05] transition-colors z-10"><X size={18} className="text-text-tertiary" /></button>
              <div className="relative h-[360px]">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div key={step} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="absolute inset-0">
                    {step === 'email' && (
                      <div className="space-y-6">
                        <div className="text-center">
                          <h2 className="font-serif text-2xl font-bold text-text-primary mb-2">Welcome back</h2>
                          <p className="text-sm text-text-secondary">Sign in to your Wealth AI account</p>
                        </div>
                        <div className="space-y-4">
                          <div className="relative">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"
                              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.03] border border-border-subtle text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-accent-emerald/50 focus:ring-1 focus:ring-accent-emerald/20 transition-all" />
                          </div>
                          <FluidButton className="w-full" onClick={() => goTo('password', 1)} disabled={!email}>Continue<ArrowRight size={16} /></FluidButton>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-subtle" /></div>
                          <div className="relative flex justify-center text-xs"><span className="px-2 bg-card text-text-muted">or</span></div>
                        </div>
                        <FluidButton variant="secondary" className="w-full" onClick={() => goTo('passkey', 1)}><Fingerprint size={16} />Sign in with Passkey</FluidButton>
                        <p className="text-center text-xs text-text-tertiary">Don't have an account? <button onClick={() => goTo('register', 1)} className="text-accent-emerald hover:underline">Sign up</button></p>
                      </div>
                    )}
                    {step === 'password' && (
                      <div className="space-y-6">
                        <div className="text-center">
                          <h2 className="font-serif text-2xl font-bold text-text-primary mb-2">Enter password</h2>
                          <p className="text-sm text-text-secondary">{email}</p>
                        </div>
                        <div className="space-y-4">
                          <div className="relative">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                              className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/[0.03] border border-border-subtle text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-accent-emerald/50 focus:ring-1 focus:ring-accent-emerald/20 transition-all" />
                            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                          </div>
                          <FluidButton className="w-full">Sign In</FluidButton>
                        </div>
                        <button onClick={() => goTo('email', -1)} className="flex items-center gap-2 text-sm text-text-tertiary hover:text-text-secondary transition-colors mx-auto"><ArrowLeft size={14} />Back</button>
                      </div>
                    )}
                    {step === 'passkey' && (
                      <div className="space-y-6 text-center">
                        <h2 className="font-serif text-2xl font-bold text-text-primary mb-2">Use your passkey</h2>
                        <p className="text-sm text-text-secondary">Verify your identity with biometrics</p>
                        <div className="flex justify-center py-8">
                          <motion.button onClick={handlePasskey} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="relative w-24 h-24 rounded-3xl glass border border-border-default flex items-center justify-center">
                            <Fingerprint size={40} className="text-accent-emerald" />
                            {isPasskeyScanning && (
                              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute inset-0 rounded-3xl border-2 border-accent-emerald/50" />
                            )}
                          </motion.button>
                        </div>
                        <p className="text-xs text-text-muted">Touch the fingerprint sensor or use Face ID</p>
                        <button onClick={() => goTo('email', -1)} className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">Use password instead</button>
                      </div>
                    )}
                    {step === 'register' && (
                      <div className="space-y-6">
                        <div className="text-center">
                          <h2 className="font-serif text-2xl font-bold text-text-primary mb-2">Create account</h2>
                          <p className="text-sm text-text-secondary">Start your financial journey</p>
                        </div>
                        <div className="space-y-4">
                          <div className="relative">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                            <input type="email" placeholder="name@example.com"
                              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.03] border border-border-subtle text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-accent-emerald/50 focus:ring-1 focus:ring-accent-emerald/20 transition-all" />
                          </div>
                          <div className="relative">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                            <input type="password" placeholder="Create password"
                              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.03] border border-border-subtle text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-accent-emerald/50 focus:ring-1 focus:ring-accent-emerald/20 transition-all" />
                          </div>
                          <FluidButton className="w-full">Create Account</FluidButton>
                        </div>
                        <p className="text-center text-xs text-text-tertiary">Already have an account? <button onClick={() => goTo('email', -1)} className="text-accent-emerald hover:underline">Sign in</button></p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
