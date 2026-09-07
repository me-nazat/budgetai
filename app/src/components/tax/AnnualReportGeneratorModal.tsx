'use client';

/**
 * @fileoverview Feature 12.2: Annual Fiscal Report Generator & Accountant Share Modal.
 * Generates official PDF/Excel reports and creates 30-day view-only accountant share tokens.
 *
 * @module components/tax/AnnualReportGeneratorModal
 */

import React, { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ShareRecord {
  id: string;
  token: string;
  taxYear: number;
  expiresAt: number;
  viewCount: number;
  createdAt: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultYear?: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AnnualReportGeneratorModal({ isOpen, onClose, defaultYear = 2026 }: Props) {
  const [taxYear, setTaxYear] = useState<number>(defaultYear);
  const [jurisdiction, setJurisdiction] = useState('US_IRS');
  const [isSharing, setIsSharing] = useState(false);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);

  const { data, mutate } = useSWR<{ shares: ShareRecord[] }>('/api/tax/share', fetcher);
  const shares = data?.shares || [];

  const handleCreateShare = async () => {
    setIsSharing(true);
    try {
      const res = await fetch('/api/tax/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxYear, expiresInDays: 30 }),
      });

      if (!res.ok) throw new Error('Failed to generate accountant share link');
      const result = await res.json();
      setNewShareUrl(window.location.origin + result.shareUrl);
      toast.success('30-day accountant link created! Copied to clipboard.');
      navigator.clipboard.writeText(window.location.origin + result.shareUrl);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Share generation failed');
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeShare = async (token: string) => {
    try {
      const res = await fetch(`/api/tax/share?token=${token}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke link');
      toast.success('Accountant share link revoked');
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full sm:max-w-lg bg-surface-primary border border-border-subtle rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="w-12 h-1 bg-border-strong rounded-full mx-auto sm:hidden" />
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div>
            <h3 className="text-lg font-bold text-content-primary">Fiscal Report Exporter</h3>
            <p className="text-xs text-content-muted">Certified annual documentation for tax accountants</p>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-surface-secondary text-content-muted"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Configuration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-content-muted block mb-1">Tax Year</label>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary font-bold focus:ring-2 focus:ring-emerald-500"
            >
              {[2026, 2025, 2024, 2023].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-content-muted block mb-1">Jurisdiction</label>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-xs text-content-primary font-bold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="US_IRS">US (IRS Schedule C)</option>
              <option value="UK_HMRC">UK (HMRC Self Assessment)</option>
              <option value="CA_CRA">Canada (CRA T2125)</option>
              <option value="EU_GENERIC">European Union (VAT/Fiscal)</option>
            </select>
          </div>
        </div>

        {/* Primary Download CTAs */}
        <div className="space-y-2.5 pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-content-muted block">
            Direct Downloads
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={`/api/tax/export?year=${taxYear}&jurisdiction=${jurisdiction}&format=pdf`}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Download PDF Report
            </a>
            <a
              href={`/api/tax/export?year=${taxYear}&jurisdiction=${jurisdiction}&format=xlsx`}
              download
              className="min-h-[44px] px-4 py-3 rounded-xl bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle text-content-primary font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              Download Excel (4 Sheets)
            </a>
          </div>
        </div>

        {/* Accountant Share Link Generator */}
        <div className="p-4 rounded-2xl bg-surface-secondary border border-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-content-primary">
              Share View-Only Link with Accountant
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold uppercase">
              30 Days Valid
            </span>
          </div>
          <p className="text-[11px] text-content-muted">
            Allows your accountant to view itemized write-offs and receipt references online without logging into your account.
          </p>

          <button
            onClick={handleCreateShare}
            disabled={isSharing}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            {isSharing ? 'Generating Link...' : 'Generate 30-Day View Token'}
          </button>

          {newShareUrl && (
            <div className="p-2.5 rounded-xl bg-surface-primary border border-border-subtle flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-content-primary truncate max-w-[280px]">
                {newShareUrl}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newShareUrl);
                  toast.success('Copied link');
                }}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 shrink-0"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Active Shares List */}
        {shares.length > 0 && (
          <div className="space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-content-muted block">
              Active Accountant Shares ({shares.length})
            </span>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {shares.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl bg-surface-secondary border border-border-subtle flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-content-primary">Tax Year {s.taxYear}</span>
                    <span className="text-[10px] text-content-muted block">
                      Expires: {new Date(s.expiresAt * 1000).toLocaleDateString()} • Views: {s.viewCount}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevokeShare(s.token)}
                    className="min-h-[44px] px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-400 hover:text-red-300"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
