'use client';

import { useState, useEffect, useCallback } from 'react';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';
import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function SettingsPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [currency, setCurrency] = useState<CurrencyCode>('BDT');
    const [notifyBudget, setNotifyBudget] = useState(true);
    const [notifyOverspend, setNotifyOverspend] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false);
    const [avatarHovered, setAvatarHovered] = useState(false);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        fetch('/api/auth/me').then(r => r.json()).then(d => {
            if (d.user) {
                setName(d.user.name); setEmail(d.user.email); setCurrency((d.user.currency || 'BDT') as CurrencyCode);
                setNotifyBudget(!!d.user.notify_budget); setNotifyOverspend(!!d.user.notify_overspend);
            }
        });

        return () => observer.disconnect();
    }, []);

    const save = async () => {
        setSaving(true);
        await fetch('/api/settings', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, currency, notify_budget: notifyBudget, notify_overspend: notifyOverspend })
        });
        localStorage.setItem('budget-ai-currency', currency);
        setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
    };

    const toggleTheme = useCallback(() => {
        const html = document.documentElement;
        html.classList.add('theme-transitioning');
        html.classList.toggle('dark');
        const newDark = html.classList.contains('dark');
        setIsDark(newDark);
        localStorage.setItem('budget-ai-theme', newDark ? 'dark' : 'light');
        setTimeout(() => html.classList.remove('theme-transitioning'), 400);
    }, []);

    const handleSignOut = async () => {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        localStorage.removeItem('wealth-ai-swr-cache-v1');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/login';
    };

    return (
        <motion.div 
            className="p-4 lg:p-8 max-w-[800px] mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >

            {/* ═══════════════════════════════════════════════
               MOBILE SETTINGS VIEW
               ═══════════════════════════════════════════════ */}
            <div className="lg:hidden space-y-6">
                {/* Profile Header (Redesigned) */}
                <motion.div variants={itemVariants} className="flex flex-col items-center text-center pt-4 relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" />

                    <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary via-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold shadow-xl shadow-primary/20 mb-4 overflow-hidden border border-white/20">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse" style={{ animationDuration: '3s' }} />
                        <span className="relative z-10">{name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    </div>

                    <div className="bg-white/50 dark:bg-[#161b22]/50 backdrop-blur-md px-6 py-2 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{name || 'User'}</h2>
                        <p className="text-sm font-medium text-gray-500 dark:text-text-muted">{email}</p>
                    </div>
                </motion.div>

                {/* Settings Groups */}
                <div className="space-y-4">
                    {/* Account */}
                    <motion.div variants={itemVariants} className="glass-panel rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-[#0d1117]/80 backdrop-blur-md border-b border-gray-100 dark:border-[#21262d]">
                            <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Account</p>
                        </div>
                        <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#21262d]">
                            <label className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider mb-1.5 block">Display Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            />
                        </div>
                        <button onClick={save} disabled={saving} className="w-full px-4 py-3.5 text-sm font-bold text-primary dark:text-emerald-400 text-center active:bg-gray-50 dark:active:bg-[#0d1117] transition-colors disabled:opacity-50">
                            {saved ? '✓ Saved Successfully' : saving ? 'Saving...' : 'Save Profile'}
                        </button>
                    </motion.div>

                    {/* Preferences */}
                    <motion.div variants={itemVariants} className="glass-panel rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-[#0d1117]/80 backdrop-blur-md border-b border-gray-100 dark:border-[#21262d]">
                            <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Preferences</p>
                        </div>
                        <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#21262d]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Currency</span>
                                </div>
                                <select
                                    value={currency}
                                    onChange={e => { setCurrency(e.target.value as CurrencyCode); }}
                                    className="bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 font-bold outline-none"
                                >
                                    {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => (
                                        <option key={code} value={code}>{CURRENCIES[code].flag} {code}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="px-4 py-3.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px]">{isDark ? 'dark_mode' : 'light_mode'}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Dark Mode</span>
                                </div>
                                <button
                                    onClick={toggleTheme}
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                                >
                                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-500 ease-spring ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Notifications */}
                    <motion.div variants={itemVariants} className="glass-panel rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-[#0d1117]/80 backdrop-blur-md border-b border-gray-100 dark:border-[#21262d]">
                            <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Notifications</p>
                        </div>
                        {[
                            { label: 'Budget Alerts', icon: 'trending_up', desc: 'Alert when nearing budget limits', value: notifyBudget, setter: setNotifyBudget, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                            { label: 'Overspending', icon: 'warning', desc: 'Alert on unusual spending', value: notifyOverspend, setter: setNotifyOverspend, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                        ].map((item, i) => (
                            <div key={i} className={`px-4 py-3.5 ${i < 1 ? 'border-b border-gray-100 dark:border-[#21262d]' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center`}>
                                            <span className={`material-symbols-outlined ${item.color} text-[18px]`}>{item.icon}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => item.setter(!item.value)}
                                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${item.value ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-500 ease-spring ${item.value ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Sign Out */}
                    <motion.div variants={itemVariants}>
                        <button
                            onClick={handleSignOut}
                            className="w-full glass-panel rounded-2xl p-4 text-rose-500 font-bold text-sm text-center active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">logout</span> Sign Out
                        </button>
                    </motion.div>

                    <motion.div variants={itemVariants} className="text-center pt-2 pb-6">
                        <p className="text-[11px] font-medium tracking-wide text-gray-400 dark:text-text-muted/60 uppercase">Wealth AI Version 1.5.0</p>
                        <p className="text-[10px] text-gray-400/60 dark:text-text-muted/40 mt-1">Made with ❤️ for precision</p>
                    </motion.div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
               DESKTOP VIEW (hidden on mobile)
               ═══════════════════════════════════════════════ */}
            <div className="hidden lg:block">
                <motion.div variants={itemVariants} className="mb-10">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 mb-2 tracking-tight">Settings</h1>
                    <p className="text-gray-500 dark:text-text-muted text-sm font-medium">Manage your personal profile and application preferences</p>
                </motion.div>

                <div className="grid grid-cols-12 gap-8">
                    {/* Left Column */}
                    <div className="col-span-8 space-y-6">
                        {/* Profile Card */}
                        <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8 relative overflow-hidden group">
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform duration-700 group-hover:scale-110" />
                            
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2 relative z-10">
                                <span className="material-symbols-outlined text-primary">person</span>Profile Information
                            </h2>
                            
                            <div className="flex items-start gap-8 relative z-10">
                                {/* Dynamic Avatar */}
                                <div 
                                    className="relative w-24 h-24 rounded-full p-1 bg-gradient-to-br from-primary via-blue-500 to-indigo-600 shadow-xl shadow-primary/20 shrink-0 cursor-pointer overflow-hidden"
                                    onMouseEnter={() => setAvatarHovered(true)}
                                    onMouseLeave={() => setAvatarHovered(false)}
                                >
                                    <div className="w-full h-full rounded-full bg-white dark:bg-[#0d1117] flex items-center justify-center relative overflow-hidden">
                                        {/* Name Initial */}
                                        <span className={`text-3xl font-black bg-clip-text text-transparent bg-gradient-to-tr from-primary to-cyan-600 transition-transform duration-300 ${avatarHovered ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>
                                            {name?.charAt(0)?.toUpperCase() || 'U'}
                                        </span>
                                        
                                        {/* Hover Overlay */}
                                        <div className={`absolute inset-0 bg-primary/90 flex flex-col items-center justify-center text-white transition-opacity duration-300 ${avatarHovered ? 'opacity-100' : 'opacity-0'}`}>
                                            <span className="material-symbols-outlined text-[20px] mb-0.5">add_a_photo</span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex-1 space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Display Name</label>
                                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-transparent bg-gray-50 hover:bg-gray-100 focus:bg-white dark:bg-[#161b22] dark:hover:bg-[#1c2128] dark:focus:bg-[#0d1117] dark:border-white/5 text-gray-900 dark:text-white outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Email Address</label>
                                        <input type="email" value={email} disabled className="w-full px-4 py-3 rounded-xl border border-transparent bg-gray-50 dark:bg-[#0d1117] text-gray-400 font-medium cursor-not-allowed opacity-70" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Notifications */}
                        <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-8">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">notifications_active</span>Notification Preferences
                            </h2>
                            <div className="space-y-4">
                                {[{ label: 'Budget Limit Alerts', desc: 'Receive immediate alerts when you exceed 80% of your category limits.', value: notifyBudget, setter: setNotifyBudget, icon: 'account_balance_wallet', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                { label: 'Overspending Detection', desc: 'AI-powered alerts for unusual or exceptionally high transactions.', value: notifyOverspend, setter: setNotifyOverspend, icon: 'monitoring', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 dark:bg-[#161b22] border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-colors group">
                                        <div className="flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                                                <span className={`material-symbols-outlined ${item.color}`}>{item.icon}</span>
                                            </div>
                                            <div>
                                                <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-1">{item.label}</h3>
                                                <p className="text-gray-500 dark:text-text-muted text-xs font-medium leading-relaxed max-w-md">{item.desc}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => item.setter(!item.value)}
                                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 outline-none shadow-inner shrink-0 ${item.value ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                            <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-500 ease-spring ${item.value ? 'translate-x-7' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column */}
                    <div className="col-span-4 space-y-6">
                        {/* Appearance / Theme */}
                        <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6 relative overflow-hidden group cursor-pointer" onClick={toggleTheme}>
                            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-colors duration-500 ${isDark ? 'bg-amber-500/10' : 'bg-primary/10'}`} />
                            
                            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                                <span className={`material-symbols-outlined ${isDark ? 'text-amber-500' : 'text-primary'}`}>{isDark ? 'dark_mode' : 'light_mode'}</span>Appearance
                            </h2>
                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <h3 className="text-gray-900 dark:text-white font-bold text-sm">Dark Mode</h3>
                                    <p className="text-gray-500 dark:text-text-muted text-xs mt-0.5 font-medium">{isDark ? 'Enabled' : 'Disabled'}</p>
                                </div>
                                <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDark ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-500 ease-spring ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </div>
                        </motion.div>

                        {/* Currency */}
                        <motion.div variants={itemVariants} className="glass-panel rounded-3xl p-6">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">payments</span>Currency
                            </h2>
                            <div className="space-y-3">
                                {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => {
                                    const cur = CURRENCIES[code];
                                    const isActive = currency === code;
                                    return (
                                        <button
                                            key={code}
                                            onClick={() => setCurrency(code)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isActive
                                                ? 'bg-primary/10 border-2 border-primary/20 shadow-sm'
                                                : 'bg-gray-50 dark:bg-[#161b22] border-2 border-transparent hover:border-gray-200 dark:hover:border-white/10'
                                                }`}
                                        >
                                            <span className="text-2xl drop-shadow-sm">{cur.flag}</span>
                                            <div className="text-left flex-1 min-w-0">
                                                <div className={`font-bold text-sm ${isActive ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                                                    {cur.symbol} {cur.code}
                                                </div>
                                            </div>
                                            {isActive && (
                                                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* System Info */}
                        <motion.div variants={itemVariants} className="pt-4 px-2">
                            <p className="text-[11px] font-bold tracking-widest text-gray-400 dark:text-text-muted uppercase mb-1">System Version</p>
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Wealth AI <span className="text-primary">v1.5.0</span></p>
                        </motion.div>
                    </div>
                </div>

                {/* Bottom Action Bar */}
                <motion.div variants={itemVariants} className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200/60 dark:border-[#30363d]/50">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 px-5 py-2.5 text-rose-500 font-bold text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">logout</span> Sign Out
                    </button>

                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-2 px-8 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-black/10 dark:shadow-white/10">
                        {saved ? <><span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Saved</> :
                            saving ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> Saving...</> :
                                'Save Changes'}
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );
}
