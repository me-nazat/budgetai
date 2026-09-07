'use client';

/**
 * @fileoverview Feature 12.2: Shareable View-Only Fiscal Report for Accountants.
 * Public page accessible via 30-day token (/tax/view/[token]).
 *
 * @module app/tax/view/[token]/page
 */

import React from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { motion } from 'framer-motion';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Invalid or expired fiscal report link');
  return res.json();
});

export default function AccountantReportViewPage() {
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const { data, error, isLoading } = useSWR(`/api/tax/view/${token}`, fetcher);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">link_off</span>
          </div>
          <h1 className="text-xl font-black text-white">Report Link Unavailable</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            This accountant view-only link has expired, been revoked, or does not exist. Please request a new share link from the account owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
              Authorized Accountant View-Only Report
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Tax Year {data.taxYear} Fiscal Summary
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Taxpayer: <span className="text-white font-semibold">{data.taxpayer}</span> • Jurisdiction:{' '}
              <span className="text-white font-semibold">{data.jurisdiction}</span> • Views: {data.viewCount}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/tax/export?year=${data.taxYear}&format=pdf`}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download PDF
            </a>
            <a
              href={`/api/tax/export?year=${data.taxYear}&format=xlsx`}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              Excel (4 Sheets)
            </a>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Qualified Write-Offs
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">
              ${data.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500">{data.items.length} claimed line items</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Estimated Tax Savings (28%)
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white">
              ${data.estimatedTaxSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500">Based on standard business bracket</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Compliance Status
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-2xl">verified</span>
              Export Ready
            </div>
            <p className="text-[11px] text-slate-500">TurboTax & Xero Formatted</p>
          </div>
        </div>

        {/* Missing Receipt Callouts (> $75) */}
        {data.missingReceipts && data.missingReceipts.length > 0 && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              Documentation Warning: {data.missingReceipts.length} Expenses Exceed $75 Without Attached Receipts
            </div>
            <div className="space-y-2">
              {data.missingReceipts.map((m: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white block">{m.merchant}</span>
                    <span className="text-slate-400 text-[11px]">{m.reason}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400">${m.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {data.categoryBreakdown && data.categoryBreakdown.length > 0 && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Deductions By Category
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Tax Category</th>
                    <th className="py-2.5 px-3">Item Count</th>
                    <th className="py-2.5 px-3">Gross Total</th>
                    <th className="py-2.5 px-3">Deductible Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.categoryBreakdown.map((cat: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-3 px-3 font-semibold text-white">{cat.category}</td>
                      <td className="py-3 px-3 text-slate-400">{cat.count}</td>
                      <td className="py-3 px-3 text-slate-300 font-mono">${cat.totalAmount.toFixed(2)}</td>
                      <td className="py-3 px-3 text-emerald-400 font-mono font-bold">${cat.deductibleAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Itemized Transactions */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Itemized Write-Off Records ({data.items.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Merchant / Payee</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Receipt Document</th>
                  <th className="py-2.5 px-3 text-right">Deductible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-3 px-3 text-slate-400 font-mono">{item.date}</td>
                    <td className="py-3 px-3 font-bold text-white">{item.merchant}</td>
                    <td className="py-3 px-3 text-slate-300">{item.taxCategory}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                        item.receiptAttached ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.receiptAttached ? 'Attached' : 'Unattached'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                      ${item.deductibleAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Privacy Guarantee */}
        <div className="text-center text-xs text-slate-500 py-4">
          Protected by WealthAI Financial Privacy Layer. Read-only token expires on{' '}
          {new Date(data.expiresAt * 1000).toLocaleDateString()}.
        </div>
      </div>
    </div>
  );
}
