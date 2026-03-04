'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const navItems = [
    { href: '/dashboard', icon: 'dashboard', label: 'Dashboard', filled: true },
    { href: '/chat', icon: 'smart_toy', label: 'AI Chat' },
    { href: '/transactions', icon: 'receipt_long', label: 'Transactions' },
    { href: '/budget', icon: 'account_balance_wallet', label: 'Budgets' },
    { href: '/reports', icon: 'bar_chart', label: 'Reports' },
    { href: '/history', icon: 'chat', label: 'Chat History' },
    { href: '/networth', icon: 'trending_up', label: 'Net Worth' },
    { href: '/goals', icon: 'flag', label: 'Goals' },
    { href: '/recurring', icon: 'repeat', label: 'Recurring' },
    { href: '/notifications', icon: 'notifications', label: 'Alerts' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<{ name: string; email: string } | null>(null);
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const theme = localStorage.getItem('budget-ai-theme');
        // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
        const isPublic = window.location.pathname === '/' || window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/register');
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsDark(theme === 'dark' || (!theme && !isPublic));

        fetch('/api/auth/me').then(r => r.json()).then(d => {
            if (d.user) setUser(d.user);
        }).catch(() => { });
    }, []);

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        localStorage.setItem('budget-ai-theme', next ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', next);
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    return (
        <aside className={`
        hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 flex-col justify-between
        bg-white dark:bg-[#0d1117] border-r border-gray-200 dark:border-[#30363d]
        transition-transform duration-300
      `}>
            <div className="flex flex-col h-full">
                <div className="p-6 pb-2 shrink-0">
                    <Link
                        href="/"
                        className="flex items-center gap-3 mb-6 group cursor-pointer"
                    // Navigate to home
                    >
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0">
                            <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={40} height={40} className="object-cover" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-gray-900 dark:text-white text-lg font-bold leading-none truncate">Wealth AI</h1>
                            <p className="text-gray-500 dark:text-text-secondary text-xs font-normal mt-1 truncate">Smart Finance</p>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 lg:px-4 pb-6 space-y-1 custom-scrollbar min-h-0">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}

                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative group overflow-hidden ${isActive
                                    ? 'bg-primary/10 text-primary font-bold'
                                    : 'text-gray-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full shadow-[0_0_10px_rgba(19,109,236,0.6)]" />
                                )}
                                <span className={`material-symbols-outlined transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                                    {item.icon}
                                </span>
                                <span className={`transition-transform duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
                {/* Bottom section */}
                <div className="p-4 border-t border-gray-200 dark:border-[#30363d] shrink-0 mt-auto">
                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className="w-full mb-3 flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
                        <span className="text-sm font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>

                    {/* Settings & Logout */}
                    <Link
                        href="/settings"

                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors"
                    >
                        <span className="material-symbols-outlined">settings</span>
                        <span className="text-sm font-medium">Settings</span>
                    </Link>
                    {/* User info */}
                    {user && (
                        <div className="mt-4 flex items-center gap-3 px-3 py-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[2px] transition-transform hover:scale-105 cursor-pointer">
                                <div className="w-full h-full rounded-full bg-white dark:bg-[#0d1117] flex items-center justify-center border-2 border-transparent">
                                    <span className="material-symbols-outlined text-gray-400 dark:text-text-secondary">person</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                                <p className="text-xs text-gray-500 dark:text-text-secondary truncate">{user.email}</p>
                            </div>
                            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors group">
                                <span className="material-symbols-outlined group-hover:scale-110 transition-transform">logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
