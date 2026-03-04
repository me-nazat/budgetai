'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const mobileNavItems = [
    { href: '/dashboard', icon: 'dashboard', label: 'Home' },
    { href: '/transactions', icon: 'receipt_long', label: 'Activity' },
    { href: '/chat', icon: 'smart_toy', label: 'AI Chat' },
    { href: '/settings', icon: 'settings', label: 'Settings' },
];

export default function MobileTabBar() {
    const pathname = usePathname();

    return (
        <div className="lg:hidden fixed bottom-0 left-0 w-full z-50 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-gray-200 dark:border-[#30363d]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <nav className="flex items-center justify-around h-16 px-2">
                {mobileNavItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative ${isActive
                                    ? 'text-primary'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }`}
                        >
                            {isActive && (
                                <div className="absolute top-0 w-8 h-1 bg-primary rounded-b-full shadow-[0_4px_10px_rgba(19,109,236,0.6)]" />
                            )}
                            <span
                                className={`material-symbols-outlined text-[24px] ${isActive ? 'scale-110 translate-y-[2px]' : ''} transition-all duration-300`}
                                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                            >
                                {item.icon}
                            </span>
                            <span className={`text-[10px] font-medium tracking-wide transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-80 translate-y-0'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
