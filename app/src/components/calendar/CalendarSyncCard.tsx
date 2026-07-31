'use client';

import React, { useState } from 'react';

export function CalendarSyncCard() {
  const [synced, setSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      if (res.ok) {
        setSynced(true);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <span className="material-symbols-outlined text-xl">calendar_month</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">Google Calendar Sync</h3>
            <p className="text-xs text-slate-400">Bi-directional bill due dates & milestone alerts</p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : synced ? 'Synced' : 'Sync Calendar'}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Creates a dedicated &quot;WealthAI Financial Schedule&quot; calendar with push notifications.
      </p>
    </div>
  );
}
