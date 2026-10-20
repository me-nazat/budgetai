'use client';

/**
 * @fileoverview Simplified Automation Rules Hub (Batch 8 Part 4).
 * Provides a clean, scannable table of active auto-categorization rules with:
 * - 1-Click "Run rules on existing uncategorized transactions"
 * - Instant toggle and create/edit modal
 * - Collapsible Audit Log drawer with 1-click undo capability
 *
 * @module app/(app)/automation-rules/page
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { CATEGORIES_EXPENSE } from '@/lib/categoryUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface AutomationRule {
  id: number;
  name: string;
  triggerType: 'description_contains';
  triggerValue: string;
  actionType: 'set_category';
  actionValue: string;
  active: number;
  createdAt: string;
}

interface AuditLogEntry {
  id: number;
  ruleId: number | null;
  transactionId: number | null;
  actionPerformed: string;
  previousValue: string | null;
  newValue: string | null;
  undone: number;
  createdAt: string;
  ruleName?: string | null;
}

export default function AutomationRulesPage() {
  const { locale, t } = useLanguage();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningBatch, setRunningBatch] = useState(false);
  const { categories: customCats } = useCustomCategories('expense');
  const { mutate } = useSWRConfig();

  // Audit Log State
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [undoingId, setUndoingId] = useState<number | null>(null);

  // Modal / Drawer Form State
  const [isOpen, setIsOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [name, setName] = useState('');
  const [triggerValue, setTriggerValue] = useState('');
  const [actionValue, setActionValue] = useState('');
  const [active, setActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const allCategories = [
    ...CATEGORIES_EXPENSE.map((c) => c.label),
    ...(customCats ? customCats.map((c) => c.name) : []),
  ];

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/automation-rules');
      const data = await res.json();
      setRules(data.rules || []);
    } catch (err) {
      console.error('Failed to fetch automation rules:', err);
      toast.error('Could not load automation rules');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/automation-rules/audit');
      const data = await res.json();
      setAuditLogs(data.auditLog || []);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (isAuditOpen) {
      void fetchAuditLogs();
    }
  }, [isAuditOpen, fetchAuditLogs]);

  // Run rules on existing uncategorized transactions
  const handleRunRulesBatch = async () => {
    setRunningBatch(true);
    try {
      const res = await fetch('/api/automation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_on_uncategorized' }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          locale === 'bn'
            ? `${data.updated || 0}টি অনির্ধারিত লেনদেন স্বয়ংক্রিয়ভাবে শ্রেণিবদ্ধ করা হয়েছে`
            : `Auto-categorized ${data.updated || 0} previously uncategorized transactions!`
        );
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/transactions'));
        if (isAuditOpen) void fetchAuditLogs();
      } else {
        throw new Error('Batch rule execution failed');
      }
    } catch {
      toast.error('Failed to process uncategorized transactions');
    } finally {
      setRunningBatch(false);
    }
  };

  const handleUndoAudit = async (auditLogId: number) => {
    setUndoingId(auditLogId);
    try {
      const res = await fetch('/api/automation-rules/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditLogId }),
      });
      if (res.ok) {
        toast.success(locale === 'bn' ? 'পরিবর্তন বাতিল করা হয়েছে' : 'Rule action reverted');
        void fetchAuditLogs();
        mutate((key: string) => typeof key === 'string' && key.startsWith('/api/transactions'));
      }
    } catch {
      toast.error('Failed to undo action');
    } finally {
      setUndoingId(null);
    }
  };

  const openNewForm = () => {
    setEditingRule(null);
    setName('');
    setTriggerValue('');
    setActionValue(allCategories[0] || 'Food');
    setActive(true);
    setIsOpen(true);
  };

  const openEditForm = (rule: AutomationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setTriggerValue(rule.triggerValue);
    setActionValue(rule.actionValue);
    setActive(rule.active === 1);
    setIsOpen(true);
  };

  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!name.trim() || !triggerValue.trim() || !actionValue.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: name.trim(),
      triggerType: 'description_contains' as const,
      triggerValue: triggerValue.trim(),
      actionType: 'set_category' as const,
      actionValue,
      active: active ? 1 : 0,
    };

    try {
      if (editingRule) {
        const res = await fetch(`/api/automation-rules/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update rule');
        toast.success('Rule updated successfully');
      } else {
        const res = await fetch('/api/automation-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create rule');
        toast.success('Rule created successfully');
      }
      setIsOpen(false);
      void fetchRules();
    } catch {
      toast.error('Error saving rule');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRuleActive = async (rule: AutomationRule) => {
    const newActive = rule.active === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/automation-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (res.ok) {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: newActive } : r)));
        toast.success(newActive === 1 ? 'Rule activated' : 'Rule paused');
      }
    } catch {
      toast.error('Failed to toggle rule state');
    }
  };

  const deleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch(`/api/automation-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
        toast.success('Rule deleted');
      }
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-400 text-2xl">rule</span>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {locale === 'bn' ? 'স্বয়ংক্রিয় আর্থিক নিয়মাবলী' : 'Merchant Automation Rules'}
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {locale === 'bn'
              ? 'মার্চেন্ট ও কীওয়ার্ডের ভিত্তিতে স্বয়ংক্রিয় শ্রেণিবিন্যাস এবং ট্যাক্স ট্যাগিং'
              : 'Zero-effort background classification rules triggered automatically during transaction entry'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRunRulesBatch}
            disabled={runningBatch || rules.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-xs font-bold text-sky-400 transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${runningBatch ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>
              {runningBatch
                ? 'Processing...'
                : locale === 'bn'
                ? 'অনির্ধারিত লেনদেনে নিয়ম প্রয়োগ করুন'
                : 'Run on Uncategorized'}
            </span>
          </button>

          <button
            onClick={() => setIsAuditOpen((v) => !v)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>{locale === 'bn' ? 'অডিট লগ' : 'Audit Log'}</span>
          </button>

          <button
            onClick={openNewForm}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>{locale === 'bn' ? 'নতুন নিয়ম' : 'New Rule'}</span>
          </button>
        </div>
      </div>

      {/* Scannable Active Rules Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            {locale === 'bn' ? 'সক্রিয় নিয়ম তালিকা' : 'Active Rules Registry'} ({rules.length})
          </h2>
          <span className="text-xs text-slate-500">
            {locale === 'bn' ? 'স্বয়ংক্রিয় ম্যাচিং' : 'Exact & partial keyword matching'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading automation rules...</div>
        ) : rules.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-slate-600">playlist_add_check</span>
            <p className="text-xs text-slate-400">No automation rules configured yet.</p>
            <button
              onClick={openNewForm}
              className="text-xs font-bold text-emerald-400 hover:underline"
            >
              + Create your first rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold">
                  <th className="py-2.5 px-3">Rule Name</th>
                  <th className="py-2.5 px-3">Trigger Condition</th>
                  <th className="py-2.5 px-3">Target Category</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-200">{rule.name}</td>
                    <td className="py-3 px-3 text-slate-300">
                      If description contains{' '}
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                        "{rule.triggerValue}"
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                        <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        {rule.actionValue}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => toggleRuleActive(rule)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-all ${
                          rule.active === 1
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {rule.active === 1 ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => openEditForm(rule)}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Edit rule"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-slate-400 hover:text-rose-400 transition-colors"
                        title="Delete rule"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collapsible Audit Log Drawer */}
      <AnimatePresence>
        {isAuditOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-md space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-sky-400 text-lg">history</span>
                  {locale === 'bn' ? 'স্বয়ংক্রিয় নিয়ম অডিট লগ' : 'Automation Audit Log & Undo History'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track rule firings and easily revert any unwanted category assignments
                </p>
              </div>
              <button
                onClick={() => setIsAuditOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close Drawer
              </button>
            </div>

            {loadingAudit ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading audit log...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No recent automated actions recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-200">
                        {log.actionPerformed}{' '}
                        {log.ruleName && <span className="text-slate-400">({log.ruleName})</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Previous: <span className="text-slate-400">{log.previousValue || 'None'}</span> •{' '}
                        {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div>
                      {log.undone === 1 ? (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                          Reverted
                        </span>
                      ) : (
                        <button
                          onClick={() => handleUndoAudit(log.id)}
                          disabled={undoingId === log.id}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-slate-700 text-[11px] font-bold transition-all disabled:opacity-40"
                        >
                          {undoingId === log.id ? 'Reverting...' : 'Undo'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create / Edit Rule Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 z-10"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">
                  {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={saveRule} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Uber / Pathao Transport Rule"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    If Merchant / Description contains
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pathao or Starbucks"
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Automatically assign category to
                  </label>
                  <select
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-white outline-none focus:border-emerald-500"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="rule-active"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="rounded border-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="rule-active" className="text-slate-300 font-medium">
                    Rule is actively enabled
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
