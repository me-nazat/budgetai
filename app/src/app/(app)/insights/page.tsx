'use client';

/**
 * @fileoverview Unified AI Financial Insights Hub Page (Module 19).
 * Displays proactive anomaly detections, spending spikes, subscription leaks,
 * and savings opportunities grouped by severity (CRITICAL, WARNING, INFO).
 *
 * Provides:
 * - Direct deep-link "Take action" triggers
 * - "Explain with AI Coach" contextual handoff
 * - Dismiss and user feedback rating ('helpful' vs 'not_helpful')
 * - On-demand insight synthesis
 * - Bilingual support (EN ⇄ বাংলা)
 *
 * @module app/(app)/insights/page
 */

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocaleDate } from '@/lib/formatters/locale';

interface ProactiveInsightItem {
  id: string;
  insightType: 'SPENDING_SPIKE' | 'SUBSCRIPTION_LEAK' | 'SAVINGS_OPPORTUNITY' | 'BUDGET_OVERRUN' | 'BENCHMARK_PERCENTILE' | 'GOAL_MILESTONE' | string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  description: string;
  actionLink?: string | null;
  generatedAt?: number | null;
  createdAt: string;
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    label: 'Critical Alert',
    badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    border: 'border-l-rose-500',
    icon: 'priority_high',
    iconBg: 'bg-rose-500/10 text-rose-500',
  },
  WARNING: {
    label: 'Caution & Warning',
    badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    border: 'border-l-amber-500',
    icon: 'warning',
    iconBg: 'bg-amber-500/10 text-amber-500',
  },
  INFO: {
    label: 'Informational Tip',
    badgeBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    border: 'border-l-blue-500',
    icon: 'info',
    iconBg: 'bg-blue-500/10 text-blue-500',
  },
};

export default function InsightsHubPage() {
  const { locale, t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [generating, setGenerating] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, string>>({});

  const { data, isLoading } = useSWR<{ insights: ProactiveInsightItem[] }>(
    '/api/coach/insights',
    (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data || d)
  );

  const rawInsights = data?.insights || [];
  const filtered = rawInsights.filter((item) => {
    if (activeFilter === 'ALL') return true;
    return item.severity?.toUpperCase() === activeFilter;
  });

  const handleDismiss = async (id: string, feedback: 'helpful' | 'not_helpful' | 'dismissed' = 'dismissed') => {
    try {
      const res = await fetch(`/api/insights/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });

      if (res.ok) {
        setFeedbackSent((prev) => ({ ...prev, [id]: feedback }));
        await mutate('/api/coach/insights');
        if (feedback !== 'dismissed') {
          toast.success(
            locale === 'bn'
              ? 'মতামত সংরক্ষিত হয়েছে। ধন্যবাদ!'
              : 'Feedback saved. Thank you!'
          );
        } else {
          toast.success(
            locale === 'bn' ? 'ইনসাইট সফলভাবে সরানো হয়েছে।' : 'Insight dismissed.'
          );
        }
      }
    } catch {
      toast.error('Failed to dismiss insight');
    }
  };

  const handleGenerateFresh = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/cron/insights-generate', { method: 'POST' });
      if (res.ok) {
        toast.success(
          locale === 'bn'
            ? 'নতুন প্রোঅ্যাকটিভ ইনসাইট তৈরি হয়েছে!'
            : 'Fresh AI insights synthesized from latest ledger telemetry!'
        );
        await mutate('/api/coach/insights');
      } else {
        toast.error('Failed to synthesize insights');
      }
    } catch {
      toast.error('Error contacting AI synthesis engine');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1100px] mx-auto page-enter pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span
              className="material-symbols-outlined text-primary text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lightbulb
            </span>
            {t('insights.title', 'Unified Financial Insights Hub')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-text-muted mt-1 max-w-2xl">
            {t(
              'insights.subtitle',
              'Autonomous surveillance of spending deviations, recurring leaks, and capital growth opportunities.'
            )}
          </p>
        </div>

        <button
          onClick={handleGenerateFresh}
          disabled={generating}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
        >
          <span className={`material-symbols-outlined text-base ${generating ? 'animate-spin' : ''}`}>
            {generating ? 'progress_activity' : 'auto_awesome'}
          </span>
          {generating
            ? t('insights.generating', 'Analyzing ledger...')
            : t('insights.generateNow', 'Synthesize Fresh Insights')}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'ALL', label: t('insights.filterAll', 'All Signals') },
          { id: 'CRITICAL', label: t('insights.severity.critical', 'High Priority Alert') },
          { id: 'WARNING', label: t('insights.severity.warning', 'Cautionary Alert') },
          { id: 'INFO', label: t('insights.severity.info', 'Notice') },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              activeFilter === tab.id
                ? 'bg-primary text-white shadow-md'
                : 'bg-gray-100 dark:bg-[#161b22] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Insights Stream */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel h-36 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-gray-200/80 dark:border-white/10">
          <span className="material-symbols-outlined text-5xl text-accent-emerald mb-3 block">
            verified
          </span>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {t('insights.emptyTitle', 'Financial Horizon Completely Stable')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-text-muted mt-1 max-w-md mx-auto">
            {t(
              'insights.emptyDescription',
              'No anomalous spending, recurring subscription leaks, or budget threats detected across your accounts.'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filtered.map((item) => {
              const severityKey = (item.severity || 'INFO').toUpperCase() as keyof typeof SEVERITY_CONFIG;
              const cfg = SEVERITY_CONFIG[severityKey] || SEVERITY_CONFIG.INFO;
              const hasFeedback = feedbackSent[item.id];

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className={`glass-panel rounded-3xl p-5 border-l-4 ${cfg.border} border-t border-r border-b border-gray-200/80 dark:border-white/10 shadow-sm relative space-y-3.5`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl ${cfg.iconBg} flex items-center justify-center shrink-0`}
                      >
                        <span className="material-symbols-outlined text-xl">{cfg.icon}</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                            {item.title}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.badgeBg}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
                          {item.message || item.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDismiss(item.id, 'dismissed')}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
                      title={t('insights.actions.dismiss', 'Dismiss Alert')}
                      aria-label="Dismiss"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>

                  {/* Actions & Feedback Row */}
                  <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      {item.actionLink && (
                        <Link
                          href={`${item.actionLink}${item.actionLink.includes('?') ? '&' : '?'}fromInsight=${encodeURIComponent(item.id)}`}
                          className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 min-h-[44px]"
                        >
                          <span className="material-symbols-outlined text-sm">bolt</span>
                          {t('insights.actions.takeAction', 'Take Action')}
                        </Link>
                      )}

                      <Link
                        href={`/chat?prompt=${encodeURIComponent(`Explain this financial insight in detail: "${item.title}" - ${item.message}`)}`}
                        className="px-3 py-2 rounded-xl text-primary hover:bg-primary/10 font-bold text-xs transition-colors flex items-center gap-1 min-h-[44px]"
                      >
                        <span className="material-symbols-outlined text-sm">forum</span>
                        {t('insights.actions.explain', 'Explain with AI Coach')}
                      </Link>
                    </div>

                    {/* Feedback Ratings */}
                    <div className="flex items-center gap-2 text-gray-400 self-end sm:self-auto">
                      <span className="text-[10px] uppercase font-semibold">Helpful?</span>
                      <button
                        onClick={() => handleDismiss(item.id, 'helpful')}
                        disabled={Boolean(hasFeedback)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          hasFeedback === 'helpful'
                            ? 'bg-accent-emerald/20 text-accent-emerald font-bold'
                            : 'hover:bg-gray-100 dark:hover:bg-white/10 hover:text-accent-emerald'
                        }`}
                        title="Helpful"
                      >
                        <span className="material-symbols-outlined text-base">thumb_up</span>
                      </button>
                      <button
                        onClick={() => handleDismiss(item.id, 'not_helpful')}
                        disabled={Boolean(hasFeedback)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          hasFeedback === 'not_helpful'
                            ? 'bg-rose-500/20 text-rose-500 font-bold'
                            : 'hover:bg-gray-100 dark:hover:bg-white/10 hover:text-rose-500'
                        }`}
                        title="Not relevant"
                      >
                        <span className="material-symbols-outlined text-base">thumb_down</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
