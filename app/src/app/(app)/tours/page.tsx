'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { getApiErrorMessage } from '@/lib/api-errors';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useCurrency } from '@/hooks/useCurrency';
import JoinTourModal from '@/components/JoinTourModal';
import CollaborativeNavSwitcher from '@/components/CollaborativeNavSwitcher';

interface TourParticipantWithBalance {
  id: number;
  name: string;
  userId: number | null;
  paid?: number;
  balance?: number;
}

interface Tour {
  id: number;
  name: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  baseCurrency?: string;
  totalBudget?: number;
  inviteCode?: string | null;
  status?: string;
  createdAt: string | null;
  createdBy: number;
  participants: TourParticipantWithBalance[];
  totalSpent?: number;
  balances?: TourParticipantWithBalance[];
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

const TOUR_GRADIENTS = [
  'from-[#081C15] via-[#1B4332] to-[#000000]', // Forest Emerald
  'from-[#020C1B] via-[#0A192F] to-[#010813]', // Midnight Ocean Blue
  'from-[#0F0505] via-[#3A0C0C] to-[#000000]', // Velvet Crimson Red
  'from-[#001D3D] via-[#003566] to-[#000814]', // Classic Deep Navy
  'from-[#051C1C] via-[#0E3A3A] to-[#000F0F]', // Dark Teal/Cyan
  'from-[#0F140F] via-[#1B3A1B] to-[#020A02]', // Deep Pine Green
  'from-[#1F1403] via-[#3D2606] to-[#0C0801]', // Dark Amber/Bronze
  'from-[#051F20] via-[#0B2527] to-[#010B0C]', // Deep Cyan-Gray
  'from-[#0C1E1A] via-[#15352F] to-[#030E0C]', // Rich Sage Green
  'from-[#1A0C00] via-[#2E1600] to-[#0A0500]', // Deep Chocolate/Burnt Orange
];

const TOUR_ICONS = [
  'flight_takeoff', 'explore', 'sailing', 'hiking', 'landscape',
  'directions_car', 'public', 'luggage', 'hotel', 'map'
];

type FilterStatus = 'all' | 'active' | 'upcoming' | 'settled';

export default function ToursPage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: authData } = useSWR<{ user?: { id: number; name: string } }>('/api/auth/me');
  const currentUserId = authData?.user?.id;

  const { data: responseData, error: swrError, isLoading: swrLoading, mutate } = useSWR('/api/bill-splits/tours', {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const tours = useMemo(() => (responseData?.tours as Tour[]) || [], [responseData?.tours]);
  const isLoading = swrLoading || (!responseData && !swrError);
  const error = swrError
    ? (swrError.message || 'Unable to load tours.')
    : (responseData && !responseData.success ? getApiErrorMessage(responseData, 'Unable to load tours.') : null);

  // Determine tour status based on dates
  const getTourStatus = (tour: Tour): 'active' | 'upcoming' | 'settled' => {
    if (tour.status === 'archived' || tour.status === 'settled') return 'settled';
    const now = new Date();
    if (tour.startDate) {
      const start = new Date(tour.startDate);
      if (start > now) return 'upcoming';
    }
    if (tour.endDate) {
      const end = new Date(tour.endDate);
      if (end < now) return 'settled';
    }
    return 'active';
  };

  // Get current user's balance for a tour
  const getUserBalance = useCallback((tour: Tour) => {
    if (!currentUserId || !tour.balances) return 0;
    const member = tour.balances.find((b) => b.userId === currentUserId);
    return member?.balance ?? 0;
  }, [currentUserId]);

  // 4 Top KPIs
  const kpis = useMemo(() => {
    let activeCount = 0;
    let totalSpendYtd = 0;
    let totalOwed = 0;
    let totalOwe = 0;
    const currentYear = new Date().getFullYear();

    for (const t of tours) {
      const status = getTourStatus(t);
      if (status === 'active') activeCount++;

      const tourYear = t.createdAt ? new Date(t.createdAt).getFullYear() : currentYear;
      if (tourYear === currentYear) {
        totalSpendYtd += t.totalSpent || 0;
      }

      const bal = getUserBalance(t);
      if (bal > 0.01) {
        totalOwed += bal;
      } else if (bal < -0.01) {
        totalOwe += Math.abs(bal);
      }
    }

    return {
      activeCount,
      totalSpendYtd,
      totalOwed,
      totalOwe,
    };
  }, [tours, getUserBalance]);

  // Filtered tours list
  const filteredTours = useMemo(() => {
    return tours.filter((t) => {
      const status = getTourStatus(t);
      if (activeFilter === 'active' && status !== 'active') return false;
      if (activeFilter === 'upcoming' && status !== 'upcoming') return false;
      if (activeFilter === 'settled' && status !== 'settled') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesDest = t.destination?.toLowerCase().includes(query);
        return matchesName || matchesDest;
      }
      return true;
    });
  }, [tours, activeFilter, searchQuery]);

  const deleteTour = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this tour? This cannot be undone.')) return;

    setIsDeleting(id);
    try {
      const res = await fetch(`/api/bill-splits/tours/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tour');
      await mutate();
    } catch (err) {
      console.error(err);
      alert('Unable to delete tour at this time.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Collaborative Navigation Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CollaborativeNavSwitcher />

        <div className="flex items-center gap-2.5">
          <motion.button
            onClick={() => setIsJoinModalOpen(true)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-surface-dark/90 px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.08] shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">group_add</span>
            Join with Code
          </motion.button>
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/tours/new"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-primary/25 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Tour
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Hero Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary mb-1">
          Shared Expenses & Travel
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-gray-950 dark:text-white">
          Tour Budget Manager
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
          Track group expenses, log shared trip costs, manage kitty pools, and settle balances with minimal cash transfers.
        </p>
      </div>

      {/* Top 4 KPI Summary Cards with tabular-nums & Hairline Glass Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card-glass relative overflow-hidden p-5 sm:p-6 rounded-2xl flex flex-col justify-between hover-lift group">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Active Tours</span>
            <span className="material-symbols-outlined text-[20px] text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors">
              flight_takeoff
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white tabular-nums tracking-tight">
              {kpis.activeCount}
            </h3>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Ongoing group journeys</p>
          </div>
        </div>

        <div className="card-glass relative overflow-hidden p-5 sm:p-6 rounded-2xl flex flex-col justify-between hover-lift group">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Trip Spend (YTD)</span>
            <span className="material-symbols-outlined text-[20px] text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors">
              payments
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white tabular-nums tracking-tight">
              {fmt(kpis.totalSpendYtd)}
            </h3>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Across all registered trips</p>
          </div>
        </div>

        <div className="card-glass relative overflow-hidden p-5 sm:p-6 rounded-2xl flex flex-col justify-between hover-lift group">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">You Are Owed</span>
            <span className="material-symbols-outlined text-[20px] text-emerald-500/70 group-hover:text-emerald-400 transition-colors">
              trending_up
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
              +{fmt(kpis.totalOwed)}
            </h3>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Receivable from group members</p>
          </div>
        </div>

        <div className="card-glass relative overflow-hidden p-5 sm:p-6 rounded-2xl flex flex-col justify-between hover-lift group">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">You Owe</span>
            <span className="material-symbols-outlined text-[20px] text-rose-500/70 group-hover:text-rose-400 transition-colors">
              trending_down
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tabular-nums tracking-tight">
              -{fmt(kpis.totalOwe)}
            </h3>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">Pending debt to settle</p>
          </div>
        </div>
      </div>

      {/* Search and Status Tabs Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/70 dark:bg-surface-dark/90 backdrop-blur-xl border border-gray-200/80 dark:border-white/10 max-w-fit shadow-sm">
          {[
            { id: 'all', label: 'All Trips' },
            { id: 'active', label: 'Active / Ongoing' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'settled', label: 'Settled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as FilterStatus)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeFilter === tab.id
                  ? 'bg-primary text-white shadow-md shadow-primary/25 font-black'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tours or destinations..."
            className="w-full pl-10 pr-4 py-2 text-xs font-bold text-gray-900 dark:text-white bg-white/80 dark:bg-surface-dark/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      {/* Tour Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-3xl card-glass border border-rose-500/20">
          <span className="material-symbols-outlined text-4xl text-rose-500 mb-2">error</span>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{error}</h3>
        </div>
      ) : filteredTours.length === 0 ? (
        <div className="p-12 text-center rounded-3xl card-glass border border-dashed border-gray-200 dark:border-white/10 space-y-3">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-3xl">flight_takeoff</span>
          </div>
          <h3 className="text-lg font-bold text-gray-950 dark:text-white">No tours found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search or filter keywords.'
              : 'Start a collaborative group budget for your next vacation, road trip, or family event.'}
          </p>
          <Link
            href="/tours/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-md shadow-primary/25 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Create First Tour
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTours.map((tour, index) => {
            const userBal = getUserBalance(tour);
            const status = getTourStatus(tour);
            const totalBudget = tour.totalBudget || 0;
            const spent = tour.totalSpent || 0;
            const budgetRatio = totalBudget > 0 ? Math.min(100, Math.round((spent / totalBudget) * 100)) : null;

            return (
              <motion.div
                key={tour.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ ...spring, delay: index * 0.04 }}
                onClick={() => router.push(`/tours/${tour.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-[2rem] border border-gray-200/80 dark:border-white/10 bg-white/80 dark:bg-[#0d1117]/75 p-6 shadow-xl backdrop-blur-2xl transition-all duration-500 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/20 hover:saturate-125 hover:brightness-110"
              >
                {/* Background ambient gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${TOUR_GRADIENTS[index % TOUR_GRADIENTS.length]} opacity-60 dark:opacity-45 group-hover:opacity-90 transition-opacity duration-500 pointer-events-none`} />

                {/* Hairline top-edge light reflection */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/25" />

                <div className="relative z-10 flex flex-col justify-between h-full space-y-5">
                  {/* Top Bar: Icon, Destination, Date & Delete Action */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 dark:bg-white/10 border border-white/60 dark:border-white/10 text-gray-900 dark:text-white backdrop-blur-md shadow-sm">
                        <span className="material-symbols-outlined text-[22px]">
                          {TOUR_ICONS[index % TOUR_ICONS.length]}
                        </span>
                      </div>
                      <div>
                        {tour.destination && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-primary">
                            <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                            {tour.destination}
                          </span>
                        )}
                        <h2 className="text-xl font-black text-gray-950 dark:text-white group-hover:text-primary transition-colors line-clamp-1">
                          {tour.name}
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border shadow-sm backdrop-blur-md ${
                          status === 'active'
                            ? 'bg-primary/20 border-primary/35 text-primary'
                            : status === 'upcoming'
                            ? 'bg-emerald-500/20 border-emerald-500/35 text-emerald-600 dark:text-emerald-400'
                            : 'bg-gray-100/80 dark:bg-surface-secondary/80 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {status}
                      </span>
                      {tour.createdBy === currentUserId && (
                        <button
                          onClick={(e) => deleteTour(e, tour.id)}
                          disabled={isDeleting === tour.id}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isDeleting === tour.id ? 'hourglass_empty' : 'delete'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dates & Members Avatars */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      <span>
                        {tour.startDate
                          ? `${new Date(tour.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                          : 'Flexible Dates'}
                        {tour.endDate ? ` – ${new Date(tour.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                      </span>
                    </div>

                    {/* Member Avatars Stack */}
                    <div className="flex -space-x-2 overflow-hidden">
                      {tour.participants.slice(0, 4).map((p, pIdx) => (
                        <div
                          key={p.id || pIdx}
                          title={p.name}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 border-2 border-white dark:border-slate-950 text-[10px] font-black uppercase text-white shrink-0 shadow-sm"
                        >
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                      ))}
                      {tour.participants.length > 4 && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 border-2 border-white dark:border-slate-950 text-[10px] font-black text-gray-300 shadow-sm">
                          +{tour.participants.length - 4}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Budget Utilization Progress Bar */}
                  {budgetRatio !== null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-gray-500 dark:text-gray-400">Budget Spent</span>
                        <span className="text-gray-950 dark:text-white font-mono tabular-nums">
                          {fmt(spent)} / {fmt(totalBudget)} ({budgetRatio}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            budgetRatio > 95 ? 'bg-rose-500' : budgetRatio > 75 ? 'bg-amber-400' : 'bg-primary'
                          }`}
                          style={{ width: `${budgetRatio}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Bottom Strip: Total Spent & Personal Net Position Badge */}
                  <div className="pt-3.5 border-t border-gray-200/70 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Group Spend</p>
                      <p className="text-base font-black text-gray-950 dark:text-white tabular-nums font-mono">{fmt(spent)}</p>
                    </div>

                    {/* Personal Net Position Badge */}
                    <div>
                      {userBal > 0.01 ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black shadow-sm">
                          <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                          You are owed +{fmt(userBal)}
                        </span>
                      ) : userBal < -0.01 ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-black shadow-sm">
                          <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
                          You owe -{fmt(Math.abs(userBal))}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 text-xs font-bold">
                          All settled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <JoinTourModal isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
    </div>
  );
}
