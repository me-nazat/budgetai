'use client';

import { useEffect, useState } from 'react';
import LandingPage from './LandingPage';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        // Handle both legacy and apiSuccess envelope formats
        const user = d.user || d.data?.user;
        if (user) setIsLoggedIn(true);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="w-full max-w-4xl rounded-3xl border border-gray-200/70 bg-white/70 p-5 shadow-2xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl shimmer-skeleton" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-40 rounded-full shimmer-skeleton" />
              <div className="h-2.5 w-64 max-w-full rounded-full shimmer-skeleton" />
            </div>
          </div>
          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-28 rounded-2xl shimmer-skeleton" />
            <div className="h-28 rounded-2xl shimmer-skeleton" />
            <div className="h-28 rounded-2xl shimmer-skeleton" />
          </div>
        </div>
      </div>
    );
  }

  return <LandingPage isLoggedIn={isLoggedIn} />;
}
