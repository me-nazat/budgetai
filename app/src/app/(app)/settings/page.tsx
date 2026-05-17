'use client';

import { useState, useEffect, useCallback } from 'react';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';

export default function SettingsPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [currency, setCurrency] = useState<CurrencyCode>('USD');
    const [notifyBudget, setNotifyBudget] = useState(true);
    const [notifyOverspend, setNotifyOverspend] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsDark(document.documentElement.classList.contains('dark'));
        fetch('/api/settings').then(r => r.json()).then(d => {
            if (d.user) {
                setName(d.user.name); setEmail(d.user.email); setCurrency((d.user.currency || 'USD') as CurrencyCode);
                setNotifyBudget(!!d.user.notify_budget); setNotifyOverspend(!!d.user.notify_overspend);
            }
        });
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
        html.classList.toggle('dark');
        const newDark = html.classList.contains('dark');
        setIsDark(newDark);
        localStorage.setItem('budget-ai-theme', newDark ? 'dark' : 'light');
    }, []);

    const handleSignOut = async () => {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        localStorage.removeItem('wealth-ai-swr-cache-v1');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/login';
    };

    return (
        <div className="p-4 lg:p-8 max-w-[800px] mx-auto page-enter">

            {/* ═══════════════════════════════════════════════
               MOBILE SETTINGS VIEW
               ═══════════════════════════════════════════════ */}
            <div className="lg:hidden">
                {/* Profile Header (Redesigned) */}
                <div className="flex flex-col items-center text-center mb-8 pt-4 relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse" />

                    <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary via-blue-500 to-indigo-600 dark:from-primary/80 dark:to-indigo-500/80 flex items-center justify-center text-white text-4xl font-bold shadow-xl shadow-primary/20 mb-4 overflow-hidden border border-white/20">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse" style={{ animationDuration: '3s' }} />
                        <span className="relative z-10">{name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    </div>

                    <div className="bg-white/50 dark:bg-[#161b22]/50 backdrop-blur-md px-6 py-2 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{name || 'User'}</h2>
                        <p className="text-sm font-medium text-gray-500 dark:text-text-muted">{email}</p>
                    </div>
                </div>

                {/* Settings Groups */}
                <div className="space-y-4">
                    {/* Account */}
                    <div className="card-premium rounded-2xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 dark:bg-[#0d1117]">
                            <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Account</p>
                        </div>
                        {/* Display Name */}
                        <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#21262d]">
                            <label className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider mb-1.5 block">Display Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white outline-none focus:border-primary text-sm"
                            />
                        </div>
                        {/* Email */}
                        <div className="px-4 py-3.5 border-b border-gray-100 dark:border-[#21262d]">
                            <label className="text-xs font-semibold text-gray-500 dark:text-text-muted uppercase tracking-wider mb-1.5 block">Email</label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{email}</p>
                        </div>
                        {/* Save Profile */}
                        <button onClick={save} disabled={saving} className="w-full px-4 py-3 text-sm font-bold text-primary dark:text-emerald-400 text-center active:bg-gray-50 dark:active:bg-[#0d1117] transition-colors disabled:opacity-50">
                            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>

                    {/* Preferences */}
                    <div className="card-premium rounded-2xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 dark:bg-[#0d1117]">
                            <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Preferences</p>
                        </div>
                        {/* Currency */}
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#21262d]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary text-xl">payments</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">Currency</span>
                                </div>
                                <select
                                    value={currency}
                                    onChange={e => { setCurrency(e.target.value as CurrencyCode); }}
                                    className="bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 font-semibold outline-none"
                                >
                                    {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => (
                                        <option key={code} value={code}>{CURRENCIES[code].flag} {code}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {/* Theme */}
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#21262d]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-amber-500 text-xl">{isDark ? 'dark_mode' : 'light_mode'}</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</span>
                                </div>
                                <button
                                    onClick={toggleTheme}
                                    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${isDark ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                                >
                                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-500 ease-spring ${isDark ? 'translate-x-7' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="card-premium rounded-2xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 dark:bg-[#0d1117]">
                            <p className="text-[11px] font-bold text-gray-400 dark:text-text-muted uppercase tracking-wider">Notifications</p>
                        </div>
                        {[
                            { label: 'Budget Alerts', icon: 'trending_up', desc: 'Alert when nearing budget limits', value: notifyBudget, setter: setNotifyBudget },
                            { label: 'Overspending', icon: 'warning', desc: 'Alert on unusual spending', value: notifyOverspend, setter: setNotifyOverspend },
                        ].map((item, i) => (
                            <div key={i} className={`px-4 py-3 ${i < 1 ? 'border-b border-gray-100 dark:border-[#21262d]' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary text-xl">{item.icon}</span>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                                            <p className="text-xs text-gray-400 dark:text-text-muted">{item.desc}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => item.setter(!item.value)}
                                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${item.value ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-500 ease-spring ${item.value ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Sign Out */}
                    <button
                        onClick={handleSignOut}
                        className="w-full card-premium rounded-2xl p-3.5 text-rose-500 font-bold text-sm text-center active:bg-rose-50 dark:active:bg-rose-500/10 transition-colors"
                    >
                        Sign Out
                    </button>

                    <div className="text-center pb-4">
                        <p className="text-[11px] text-gray-400 dark:text-text-muted">Wealth AI v1.0 • Made with ❤️</p>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
               DESKTOP VIEW (hidden on mobile)
               ═══════════════════════════════════════════════ */}
            <div className="hidden lg:block">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Settings</h1>
                <p className="text-gray-500 dark:text-text-muted text-sm mb-8">Manage your profile and preferences</p>

                {/* Profile */}
                <div className="card-premium rounded-2xl p-6 mb-6" style={{ animation: 'slideUp 0.5s ease-out 0.1s both' }}>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">person</span>Profile Information
                    </h2>
                    <div className="space-y-5">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/30">
                                {name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                                <p className="text-gray-900 dark:text-white font-bold text-lg">{name || 'User'}</p>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">{email}</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Display Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-surface-dark text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                            <input type="email" value={email} disabled className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-100 dark:bg-[#0d1117] text-gray-400 cursor-not-allowed" />
                            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                        </div>
                        <div className="pt-2 flex justify-end">
                            <button onClick={save} disabled={saving} className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold transition-transform hover:-translate-y-0.5 shadow-sm disabled:opacity-50">
                                {saved ? 'Saved!' : 'Save Profile'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Currency Toggle — USD / BDT */}
                <div className="card-premium rounded-2xl p-6 mb-6" style={{ animation: 'slideUp 0.5s ease-out 0.2s both' }}>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">payments</span>Currency
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-text-muted mb-4">Choose your preferred display currency. All amounts will be converted automatically.</p>
                    <div className="grid grid-cols-2 gap-4">
                        {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => {
                            const cur = CURRENCIES[code];
                            const isActive = currency === code;
                            return (
                                <button
                                    key={code}
                                    onClick={() => setCurrency(code)}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all hover:-translate-y-1 ${isActive
                                        ? 'border-primary bg-primary/10 shadow-md shadow-primary/20 ring-2 ring-primary/20'
                                        : 'border-transparent bg-gray-50 dark:bg-[#0d1117] hover:border-primary/40'
                                        }`}
                                >
                                    <span className="text-3xl drop-shadow-sm">{cur.flag}</span>
                                    <div className="text-left">
                                        <div className={`font-bold text-lg ${isActive ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                                            {cur.symbol} {cur.code}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-text-muted font-medium">{cur.name}</div>
                                    </div>
                                    {isActive && (
                                        <span className="material-symbols-outlined text-primary ml-auto drop-shadow-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">info</span>
                        Exchange rate: 1 USD ≈ 121 BDT (approximate)
                    </p>
                </div>

                {/* Theme Toggle (Desktop) */}
                <div className="card-premium rounded-2xl p-6 mb-6" style={{ animation: 'slideUp 0.5s ease-out 0.3s both' }}>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500">{isDark ? 'dark_mode' : 'light_mode'}</span>Appearance
                    </h2>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] hover:border-primary/30 transition-colors">
                        <div>
                            <h3 className="text-gray-900 dark:text-white font-bold text-sm">Dark Mode</h3>
                            <p className="text-gray-500 dark:text-text-muted text-xs mt-1 font-medium">Toggle dark mode on or off</p>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={`relative w-12 h-6 rounded-full transition-all duration-300 outline-none ${isDark ? 'bg-primary shadow-inner shadow-black/20' : 'bg-gray-300 dark:bg-gray-700 shadow-inner'}`}
                        >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                <div className="card-premium rounded-2xl p-6 mb-8" style={{ animation: 'slideUp 0.5s ease-out 0.3s both' }}>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">notifications</span>Notifications
                    </h2>
                    <div className="space-y-4">
                        {[{ label: 'Budget Limit Alerts', desc: 'Get notified when nearing or exceeding budget limits', value: notifyBudget, setter: setNotifyBudget },
                        { label: 'Overspending Alerts', desc: 'Get notified about unusual spending patterns', value: notifyOverspend, setter: setNotifyOverspend },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] hover:border-primary/30 transition-colors">
                                <div>
                                    <h3 className="text-gray-900 dark:text-white font-bold text-sm">{item.label}</h3>
                                    <p className="text-gray-500 dark:text-text-muted text-xs mt-1 font-medium">{item.desc}</p>
                                </div>
                                <button onClick={() => item.setter(!item.value)}
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 outline-none ${item.value ? 'bg-primary shadow-inner shadow-black/20' : 'bg-gray-300 dark:bg-gray-700 shadow-inner'}`}>
                                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-spring ${item.value ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center mt-6" style={{ animation: 'slideUp 0.5s ease-out 0.5s both' }}>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg font-bold transition-all"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span> Sign Out
                    </button>

                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-all disabled:opacity-50 hover:-translate-y-0.5 shadow-md btn-primary-glow select-none">
                        {saved ? <><span className="material-symbols-outlined dropdown-anim">check_circle</span> Saved Successfully</> :
                            saving ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving Changes...</> :
                                <><span className="material-symbols-outlined text-[20px]">save</span> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
