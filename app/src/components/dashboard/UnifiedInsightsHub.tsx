'use client';

import React from 'react';

export interface InsightItem {
  id: string;
  type: 'SPENDING_SPIKE' | 'SUBSCRIPTION_LEAK' | 'SAVINGS_OPPORTUNITY';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  actionLink?: string;
}

interface UnifiedInsightsHubProps {
  insights: InsightItem[];
  onDismiss: (id: string) => void;
}

export function UnifiedInsightsHub({ insights, onDismiss }: UnifiedInsightsHubProps) {
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'border-rose-500/40 bg-rose-500/10 text-rose-300';
      case 'WARNING':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
      default:
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    }
  };

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400 text-lg">auto_awesome</span>
          AI Financial Coach Insights
        </h3>
        <span className="text-xs text-slate-400">{insights.length} Active Insights</span>
      </div>

      {insights.map((item) => (
        <div
          key={item.id}
          className={`p-4 rounded-xl border backdrop-blur-md flex items-start justify-between gap-3 transition-all ${getSeverityStyle(
            item.severity
          )}`}
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">
              {item.severity === 'CRITICAL' ? 'warning' : 'trending_up'}
            </span>
            <div>
              <h4 className="text-sm font-semibold">{item.title}</h4>
              <p className="text-xs opacity-90 mt-1">{item.message}</p>
            </div>
          </div>

          <button
            onClick={() => onDismiss(item.id)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-xs shrink-0 cursor-pointer"
            title="Dismiss Insight"
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
          </button>
        </div>
      ))}
    </div>
  );
}
