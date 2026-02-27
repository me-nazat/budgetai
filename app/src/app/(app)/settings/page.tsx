'use client';

import { useState, useEffect } from 'react';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';

export default function SettingsPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [currency, setCurrency] = useState<CurrencyCode>('USD');
    const [notifyBudget, setNotifyBudget] = useState(true);
    const [notifyOverspend, setNotifyOverspend] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
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
        // Also store currency in localStorage for instant access on other pages
        localStorage.setItem('budget-ai-currency', currency);
        setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="p-4 lg:p-8 max-w-[800px] mx-auto page-enter">
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

            {/* Save */}
            <div className="flex justify-end" style={{ animation: 'slideUp 0.5s ease-out 0.4s both' }}>
                <button onClick={save} disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white rounded-lg font-bold transition-all disabled:opacity-50 hover:-translate-y-0.5 shadow-md btn-primary-glow select-none">
                    {saved ? <><span className="material-symbols-outlined dropdown-anim">check_circle</span> Saved Successfully</> :
                        saving ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving Changes...</> :
                            <><span className="material-symbols-outlined text-[20px]">save</span> Save Changes</>}
                </button>
            </div>
        </div>
    );
}
