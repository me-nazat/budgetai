'use client';

import { useState, useEffect } from 'react';

interface Notification { id: number; type: string; title: string; message: string; read: number; created_at: string; }

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const load = () => {
        fetch('/api/notifications').then(r => r.json()).then(d => {
            setNotifications(d.notifications || []);
            setUnreadCount(d.unreadCount || 0);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(load, []);

    const markRead = async (id: number) => {
        await fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        load();
    };

    const markAllRead = async () => {
        await fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) });
        load();
    };

    const typeConfig: Record<string, { icon: string; border: string; text: string }> = {
        danger: { icon: 'error', border: 'border-l-red-500', text: 'text-red-500' },
        warning: { icon: 'warning', border: 'border-l-orange-500', text: 'text-orange-500' },
        info: { icon: 'info', border: 'border-l-blue-500', text: 'text-blue-500' },
        success: { icon: 'check_circle', border: 'border-l-emerald-500', text: 'text-emerald-500' },
    };

    return (
        <div className="p-4 lg:p-8 max-w-[1000px] mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Stay updated on your budget alerts</p>
                </div>
                {unreadCount > 0 && (
                    <button onClick={markAllRead} className="px-4 py-2.5 text-primary text-sm font-bold bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">done_all</span> Mark all read
                    </button>
                )}
            </div>

            {unreadCount > 0 && (
                <div className="bg-primary/10 dark:bg-primary/5 border border-primary/20 dark:border-primary/10 rounded-xl px-5 py-4 mb-6 flex items-center gap-3 animate-fade-in">
                    <div className="relative">
                        <span className="material-symbols-outlined text-primary text-2xl">notifications_active</span>
                        <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 border border-primary/10 animate-ping"></div>
                        <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 border border-primary/10"></div>
                    </div>
                    <span className="text-primary text-sm font-bold">{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</span>
                </div>
            )}

            <div className="space-y-3">
                {loading ? <div className="text-gray-400 text-center py-8">Loading...</div> :
                    notifications.length === 0 ? (
                        <div className="text-center py-16">
                            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">notifications_off</span>
                            <p className="text-gray-400 text-lg">All clear! No notifications.</p>
                            <p className="text-gray-400 text-sm mt-1">Budget alerts and spending warnings will appear here.</p>
                        </div>
                    ) :
                        notifications.map(n => {
                            const cfg = typeConfig[n.type] || typeConfig.info;
                            return (
                                <div key={n.id} onClick={() => !n.read && markRead(n.id)}
                                    className={`flex gap-4 p-5 rounded-xl border transition-all cursor-pointer animate-slide-up group ${n.read ? 'bg-gray-50/50 dark:bg-surface-dark/50 border-gray-200/50 dark:border-[#30363d]/50 opacity-60 hover:opacity-100'
                                        : `card-premium border-l-[3px] ${cfg.border} hover:-translate-y-1 hover:shadow-lg`
                                        }`}>
                                    <div className={`flex-shrink-0 mt-1 ${cfg.text}`}>
                                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-gray-800 dark:text-white text-sm font-bold">{n.title}</h3>
                                            {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">{n.message}</p>
                                        <span className="text-gray-400 text-xs mt-2 block font-medium flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">schedule</span> {new Date(n.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
            </div>
        </div>
    );
}
