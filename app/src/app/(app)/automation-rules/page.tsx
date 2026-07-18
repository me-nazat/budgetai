'use client';

import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { CATEGORIES_EXPENSE } from '@/lib/categoryUtils';

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

export default function AutomationRulesPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { categories: customCats } = useCustomCategories('expense');
  const { mutate } = useSWRConfig();

  // Modal/Drawer Form State
  const [isOpen, setIsOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'description_contains'>('description_contains');
  const [triggerValue, setTriggerValue] = useState('');
  const [actionType, setActionType] = useState<'set_category'>('set_category');
  const [actionValue, setActionValue] = useState('');
  const [active, setActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchRules = async () => {
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
  };

  useEffect(() => {
    void fetchRules();
  }, []);

  // Compute list of categories for dropdown
  const allCategories = [
    ...CATEGORIES_EXPENSE.map(c => c.label),
    ...(customCats ? customCats.map(c => c.name) : []),
  ];

  const openNewForm = () => {
    setEditingRule(null);
    setName('');
    setTriggerType('description_contains');
    setTriggerValue('');
    setActionType('set_category');
    // Set first category as default if available
    setActionValue(allCategories[0] || 'Other');
    setActive(true);
    setIsOpen(true);
  };

  const openEditForm = (rule: AutomationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setTriggerType(rule.triggerType);
    setTriggerValue(rule.triggerValue);
    setActionType(rule.actionType);
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
      triggerType,
      triggerValue: triggerValue.trim(),
      actionType,
      actionValue,
      active: active ? 1 : 0,
    };

    try {
      const url = editingRule
        ? `/api/automation-rules/${editingRule.id}`
        : '/api/automation-rules';
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Server responded with an error');
      }

      toast.success(editingRule ? 'Rule updated successfully' : 'Rule created successfully');
      setIsOpen(false);
      await fetchRules();
    } catch (err) {
      console.error(err);
      toast.error(editingRule ? 'Failed to update rule' : 'Failed to create rule');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRuleActive = async (rule: AutomationRule) => {
    const newActiveState = rule.active === 1 ? 0 : 1;
    
    // Optimistic update
    setRules(prev =>
      prev.map(r => (r.id === rule.id ? { ...r, active: newActiveState } : r))
    );

    try {
      const res = await fetch(`/api/automation-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActiveState }),
      });
      if (!res.ok) throw new Error();
      toast.success(newActiveState === 1 ? 'Rule activated' : 'Rule deactivated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to change status');
      // Rollback
      setRules(prev =>
        prev.map(r => (r.id === rule.id ? { ...r, active: rule.active } : r))
      );
    }
  };

  const deleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const res = await fetch(`/api/automation-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Rule deleted successfully');
      setIsOpen(false);
      await fetchRules();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete rule');
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto page-enter">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Automation Rules
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">
            Create rules to automatically categorize your transactions as they are added
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Add New Rule
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-panel p-6">
              <div className="h-5 w-40 shimmer-skeleton rounded-md mb-4" />
              <div className="h-3 w-64 shimmer-skeleton rounded-md mb-2" />
              <div className="h-3 w-32 shimmer-skeleton rounded-md" />
            </div>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-primary">auto_awesome</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Rules Created Yet</h3>
          <p className="text-sm text-gray-500 dark:text-text-muted mb-6">
            Create matching rules to skip manually assigning categories to recurring purchases.
          </p>
          <button
            onClick={openNewForm}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-transform active:scale-[0.98]"
          >
            Create your first rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`glass-panel rounded-3xl p-5 border relative overflow-hidden group transition-all duration-300 hover:shadow-md hover:border-primary/20 ${
                rule.active !== 1 ? 'opacity-65' : ''
              }`}
            >
              {/* Active Stripe indicator */}
              <div
                className={`absolute top-0 left-0 w-1.5 h-full ${
                  rule.active === 1 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              />

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-black text-gray-900 dark:text-white text-base truncate pr-12">
                    {rule.name}
                  </h3>
                  <p className="text-[10px] text-gray-400 dark:text-text-muted/60 uppercase font-semibold mt-0.5 tracking-wider">
                    Created {new Date(rule.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleRuleActive(rule)}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      rule.active === 1 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                        rule.active === 1 ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => openEditForm(rule)}
                    className="p-1 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-white/5">
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    If description contains:
                  </span>
                  <span className="inline-block rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/10 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                    &ldquo;{rule.triggerValue}&rdquo;
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Assign category:
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/10 px-3 py-1.5 text-xs font-bold text-primary">
                    <span className="material-symbols-outlined text-[14px]">category</span>
                    {rule.actionValue}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DRAWERS/MODALS FOR ADD & EDIT */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center p-0 lg:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Drawer Wrapper (Mobile) & Modal Card (Desktop) */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 350 } }}
              exit={{ y: '100%', opacity: 0 }}
              className="relative w-full max-h-[90vh] lg:max-w-md overflow-y-auto rounded-t-[2.5rem] lg:rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0A0D18]/95 flex flex-col z-10"
            >
              {/* Drag Handle (Mobile only) */}
              <div className="lg:hidden w-full flex justify-center pb-5 shrink-0" onClick={() => setIsOpen(false)}>
                <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">
                  {editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <form onSubmit={saveRule} className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Starbucks Auto Rule"
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Trigger Type
                  </label>
                  <select
                    disabled
                    value={triggerType}
                    className="w-full rounded-xl bg-gray-100 dark:bg-white/10 px-4 py-3 text-sm font-bold text-gray-400 dark:text-gray-500 outline-none border border-transparent"
                  >
                    <option value="description_contains">When description contains (case-insensitive)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Text to Match
                  </label>
                  <input
                    type="text"
                    required
                    value={triggerValue}
                    onChange={e => setTriggerValue(e.target.value)}
                    placeholder="e.g. starbucks"
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Action Type
                  </label>
                  <select
                    disabled
                    value={actionType}
                    className="w-full rounded-xl bg-gray-100 dark:bg-white/10 px-4 py-3 text-sm font-bold text-gray-400 dark:text-gray-500 outline-none border border-transparent"
                  >
                    <option value="set_category">Assign Category</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Target Category
                  </label>
                  <select
                    value={actionValue}
                    onChange={e => setActionValue(e.target.value)}
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  >
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-white/5">
                  <span className="text-sm font-bold">Rule Active State</span>
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                      active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                        active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                  {editingRule && (
                    <button
                      type="button"
                      onClick={() => deleteRule(editingRule.id)}
                      className="flex-1 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold py-3.5 text-sm transition-all"
                    >
                      Delete Rule
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-2xl bg-primary text-white font-bold py-3.5 text-sm active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Rule'}
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
