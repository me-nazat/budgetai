'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
    { href: '/dashboard', icon: 'dashboard', label: 'Dashboard', filled: true },
    { href: '/chat', icon: 'smart_toy', label: 'AI Chat' },
    { href: '/transactions', icon: 'receipt_long', label: 'Transactions' },
    { href: '/budget', icon: 'account_balance_wallet', label: 'Budgets' },
    { href: '/my-month', icon: 'calendar_month', label: 'My Month' },
    { href: '/reports', icon: 'bar_chart', label: 'Reports' },
    { href: '/overview', icon: 'analytics', label: 'Overview' },
    { href: '/wealth-goals', icon: 'flag_circle', label: 'Wealth & Goals' },
    { href: '/recurring', icon: 'repeat', label: 'Recurring' },
    { href: '/notifications', icon: 'notifications', label: 'Alerts' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<{ name: string; email: string } | null>(null);
    const [isDark, setIsDark] = useState(() => {
        if (typeof window === 'undefined') return true;

        const theme = localStorage.getItem('budget-ai-theme');
        const isPublic =
            window.location.pathname === '/' ||
            window.location.pathname.startsWith('/login') ||
            window.location.pathname.startsWith('/register');

        return theme === 'dark' || (!theme && !isPublic);
    });
    const [profileHovered, setProfileHovered] = useState(false);

    useEffect(() => {
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
        localStorage.removeItem('wealth-ai-swr-cache-v1');
        router.push('/login');
    };

    return (
        <aside className={`
        hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 flex-col justify-between
        bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-xl border-r border-gray-200/50 dark:border-[#30363d]/50
        transition-transform duration-300 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)]
      `}>
            <div className="flex flex-col h-full">
                <div className="p-6 pb-2 shrink-0">
                    <Link
                        href="/"
                        className="flex items-center gap-3 mb-6 group cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0 relative">
                            <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={40} height={40} className="object-cover relative z-10" />
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-gray-900 dark:text-white text-lg font-bold leading-none truncate tracking-tight">Wealth AI</h1>
                            <p className="text-gray-500 dark:text-text-secondary text-xs font-medium mt-1 truncate">Smart Finance</p>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 lg:px-4 pb-6 space-y-1 custom-scrollbar min-h-0 relative">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative group overflow-hidden ${isActive
                                    ? 'text-primary font-bold shadow-sm'
                                    : 'text-gray-600 dark:text-text-secondary hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div 
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-xl"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_10px_rgba(19,109,236,0.8)] z-10" />
                                )}
                                
                                <span className={`material-symbols-outlined relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-3'}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                                    {item.icon}
                                </span>
                                <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
                
                {/* Bottom section (Settings & Profile) */}
                <div className="p-4 shrink-0 mt-auto">
                    {/* Settings */}
                    <Link
                        href="/settings"
                        className="flex items-center gap-3 px-4 py-3 mb-3 rounded-xl text-gray-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-surface-hover transition-all duration-300 group"
                    >
                        <span className="material-symbols-outlined group-hover:rotate-45 transition-transform duration-300">settings</span>
                        <span className="text-sm font-medium">Settings</span>
                    </Link>

                    {/* Highly Polished Profile Card */}
                    {user && (
                        <div 
                            className="relative rounded-2xl bg-gray-50 dark:bg-[#161b22] border border-gray-200/60 dark:border-white/5 p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden group"
                            onMouseEnter={() => setProfileHovered(true)}
                            onMouseLeave={() => setProfileHovered(false)}
                            onClick={() => router.push('/settings')}
                        >
                            {/* Animated Background Glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            
                            {/* Avatar */}
                            <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[2px] shrink-0 transform group-hover:scale-105 transition-transform duration-300">
                                <div className="w-full h-full rounded-full bg-white dark:bg-[#0d1117] flex items-center justify-center overflow-hidden">
                                    <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-tr from-primary to-purple-600">
                                        {user.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            
                            {/* User Info */}
                            <div className="flex-1 min-w-0 relative z-10">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate tracking-tight">{user.name}</p>
                                <p className="text-xs text-gray-500 dark:text-text-secondary truncate font-medium">{user.email}</p>
                            </div>
                            
                            {/* Hover Action (Sign Out overlay button) */}
                            <AnimatePresence>
                                {profileHovered && (
                                    <motion.button 
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleLogout();
                                        }} 
                                        className="absolute right-3 p-1.5 text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">logout</span>
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
