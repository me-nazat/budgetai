'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationItem {
  id: number;
  type: 'danger' | 'warning' | 'info' | 'success' | string;
  title: string;
  message: string;
  read: number;
  created_at: string;
  category?: 'budget' | 'anomaly' | 'bill' | 'goal' | 'system' | string;
  actionUrl?: string;
}

export default function InsightsHubPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const load = () => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications || []);
        setUnreadCount(d.unreadCount || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const markRead = async (id: number) => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });
    load();
  };

  const remove = async (id: number) => {
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const clearAll = async () => {
    if (!confirm('Clear all alerts?')) return;
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearAll: true }),
    });
    load();
  };

  // Derive categories from items
  const categories = useMemo(() => {
    const set = new Set<string>();
    notifications.forEach(n => {
      if (n.category) set.add(n.category);
    });
    return Array.from(set);
  }, [notifications]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    if (activeCategory === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.category === activeCategory || (activeCategory === 'budget' && n.title.toLowerCase().includes('budget')));
  }, [notifications, activeCategory]);

  const getCategoryIcon = (category?: string, type?: string) => {
    if (category === 'anomaly') return 'warning';
    if (category === 'bill') return 'event';
    if (category === 'goal') return 'emoji_events';
    if (category === 'budget') return 'account_balance_wallet';
    if (type === 'danger') return 'error';
    if (type === 'warning') return 'warning';
    if (type === 'success') return 'check_circle';
    return 'notifications';
  };

  const getDeepLink = (item: NotificationItem) => {
    if (item.actionUrl) return item.actionUrl;
    const lower = (item.title + ' ' + item.message).toLowerCase();
    if (lower.includes('budget')) return '/budget';
    if (lower.includes('bill') || lower.includes('recurring')) return '/recurring-subscriptions';
    if (lower.includes('goal')) return '/wealth-goals';
    if (lower.includes('benchmark')) return '/benchmarks';
    if (lower.includes('household')) return '/household';
    return '/transactions';
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1100px] mx-auto page-enter">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
            Insights & Alerts Hub
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Smart notifications, budget warnings & automated insights</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-4 py-2.5 text-primary text-sm font-bold bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">done_all</span> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="px-4 py-2.5 text-rose-600 text-sm font-bold bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Unread Badge ── */}
      {unreadCount > 0 && (
        <div className="bg-primary/10 dark:bg-primary/5 border border-primary/20 dark:border-primary/10 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined text-primary text-2xl">notifications_active</span>
            <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </div>
          <span className="text-primary text-sm font-bold">{unreadCount} new alert{unreadCount > 1 ? 's' : ''} require attention</span>
        </div>
      )}

      {/* ── Category Filter Chips ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all ${
            activeCategory === 'all'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-hover'
          }`}
        >
          All ({notifications.length})
        </button>
        {unreadCount > 0 && (
          <button
            onClick={() => setActiveCategory('unread')}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all ${
              activeCategory === 'unread'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-hover'
            }`}
          >
            Unread ({unreadCount})
          </button>
        )}
        {['budget', 'anomaly', 'bill', 'goal'].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-bold capitalize transition-all ${
              activeCategory === cat
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-hover'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Notifications List ── */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-gray-400 text-center py-12">Loading insights...</div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">notifications_off</span>
            <p className="text-gray-400 text-lg">All clear! No notifications found.</p>
            <p className="text-gray-400 text-sm mt-1">Smart alerts and spending anomaly warnings will appear here.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(n => {
              const icon = getCategoryIcon(n.category, n.type);
              const deepLink = getDeepLink(n);

              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`flex items-start gap-4 p-4 lg:p-5 rounded-2xl border transition-all cursor-pointer group ${
                    n.read
                      ? 'bg-gray-50/50 dark:bg-surface-dark/40 border-gray-200/50 dark:border-white/5 opacity-70'
                      : 'glass-panel border-l-4 border-l-primary hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    n.type === 'danger' ? 'bg-rose-500/10 text-rose-500' :
                    n.type === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                    n.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'
                  }`}>
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-gray-900 dark:text-white text-sm font-bold truncate">{n.title}</h3>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                        className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete notification"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-3">{n.message}</p>

                    <div className="flex items-center justify-between gap-4 text-xs text-gray-400">
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      <Link
                        href={deepLink}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                      >
                        Review details <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
