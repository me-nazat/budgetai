'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { createPortal } from 'react-dom';
import AnimatedCounter from '@/components/AnimatedCounter';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { getApiErrorMessage } from '@/lib/api-errors';
import { useCurrency } from '@/hooks/useCurrency';
import TourAddCostModal from '@/components/TourAddCostModal';
import TourEditCostModal from '@/components/TourEditCostModal';
import TourTransactionDetailModal from '@/components/TourTransactionDetailModal';
import { getCategoryIcon, getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import TourEditModal from '@/components/TourEditModal';
import { TiltCard } from '@/components/ui/TiltCard';
import { useDashboard } from '@/hooks/useApi';
import dynamic from 'next/dynamic';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement } from 'chart.js';
import { useHaptics } from '@/hooks/useHaptics';

const Bar = dynamic(() => import('react-chartjs-2').then(mod => mod.Bar), { ssr: false });
const Doughnut = dynamic(() => import('react-chartjs-2').then(mod => mod.Doughnut), { ssr: false });

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement);

interface TourParticipant {
  id: number;
  name: string;
  userId: number | null;
  paid?: number;
  balance?: number;
}

interface ItineraryItem {
  id: string;
  day: number;
  time: string;
  title: string;
  location: string;
  cost?: string;
  type: 'flight' | 'hotel' | 'food' | 'activity' | 'transport' | 'other';
  notes?: string;
  groupTitle?: string;
  attachmentId?: string;
  attachmentName?: string;
}

interface ChecklistItem {
  id: string;
  name: string;
  category: string;
  assignedTo: string;
  completed: boolean;
  description?: string;
  attachmentId?: string;
  attachmentName?: string;
}

interface TourTransaction {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  paidBy: number;
  paidByParticipantId?: number;
  paidByName?: string | null;
  createdById?: number | null;
  createdByName?: string | null;
  splitType: string;
  createdAt?: string | null;
}

interface Tour {
  id: number;
  name: string;
  createdAt: string | null;
  createdBy: number;
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

function TourSpendingsSkeleton() {
  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 h-28 max-w-3xl rounded-[2rem] shimmer-skeleton" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <SkeletonCard className="h-72 rounded-[2rem] md:col-span-2" />
        <SkeletonCard className="h-72 rounded-[2rem]" />
        <SkeletonCard className="h-72 rounded-[2rem] md:col-span-3" />
      </div>
    </div>
  );
}

export default function TourDashboard() {
  const params = useParams<{ id: string }>();
  const tourId = params.id;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: tourData, error: tourError, isLoading: tourLoading, mutate: mutateTour } = useSWR(
    tourId ? `/api/bill-splits/tours/${tourId}` : null,
    { revalidateOnFocus: false }
  );
  const { data: userData } = useSWR('/api/auth/me');

  const [selectedMonth] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const { data: dashboardData } = useDashboard(selectedMonth, 'all');

  const tour = tourData?.tour as Tour | null;
  const rawParticipants = tourData?.participants as TourParticipant[] | undefined;
  const rawTransactions = tourData?.transactions as TourTransaction[] | undefined;

  const participants = useMemo(() => rawParticipants ?? [], [rawParticipants]);
  const transactions = useMemo(() => {
    const list = rawTransactions ?? [];
    return [...list].sort((a: TourTransaction, b: TourTransaction) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff || Number(b.id) - Number(a.id);
    });
  }, [rawTransactions]);

  const currentUserId = userData?.user?.id as number | undefined;
  const isLoading = tourLoading || (!tourData && !tourError);
  const error = tourError ? (tourError.message || 'Unable to load tour.') : (tourData && !tourData.success ? tourData.error : null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const { fmt } = useCurrency();
  const router = useRouter();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditCostOpen, setIsEditCostOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TourTransaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { categories: customCategories } = useCustomCategories('expense');
  const haptics = useHaptics();

  // Category Filter and Pagination States
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [visibleTransactionsLimit, setVisibleTransactionsLimit] = useState<number>(15);

  // Navigation state
  const [activeTab, setActiveTab] = useState<'ledger' | 'itinerary' | 'checklist' | 'settlements'>('ledger');

  // Itinerary Planner state
  const { data: itineraryData, mutate: mutateItinerary } = useSWR<{ success: boolean; itinerary: ItineraryItem[] }>(
    tourId ? `/api/bill-splits/tours/${tourId}/itinerary` : null
  );
  const itinerary = useMemo(() => itineraryData?.itinerary ?? [], [itineraryData]);

  const [itinTitle, setItinTitle] = useState('');
  const [itinDay, setItinDay] = useState(1);
  const [itinTime, setItinTime] = useState('09:00');
  const [itinLocation, setItinLocation] = useState('');
  const [itinCost, setItinCost] = useState('');
  const [itinType, setItinType] = useState<ItineraryItem['type']>('activity');
  const [itinNotes, setItinNotes] = useState('');
  const [itinGroupTitle, setItinGroupTitle] = useState('');
  const [itinAttachment, setItinAttachment] = useState<File | null>(null);
  const [showItinGroupSuggestions, setShowItinGroupSuggestions] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isAddingItinerary, setIsAddingItinerary] = useState(false);
  
  const itinFileInputRef = useRef<HTMLInputElement>(null);
  const itinGroupInputRef = useRef<HTMLDivElement>(null);

  // Group Checklist / Packing List state
  const { data: checklistData, mutate: mutateChecklist } = useSWR<{ success: boolean; checklist: ChecklistItem[]; categories: { id: number; name: string }[] }>(
    tourId ? `/api/bill-splits/tours/${tourId}/checklist` : null
  );
  const checklist = useMemo(() => checklistData?.checklist ?? [], [checklistData]);
  const customCategoriesList = useMemo(() => checklistData?.categories ?? [], [checklistData]);

  const [checkName, setCheckName] = useState('');
  const [checkCategory, setCheckCategory] = useState('Other');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(['Everyone']);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [checkDescription, setCheckDescription] = useState('');
  const [checkAttachment, setCheckAttachment] = useState<File | null>(null);
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const [activeChecklistFilter, setActiveChecklistFilter] = useState<string>('All');
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);

  const checkFileInputRef = useRef<HTMLInputElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Close suggestions and dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
      if (itinGroupInputRef.current && !itinGroupInputRef.current.contains(event.target as Node)) {
        setShowItinGroupSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // SSE Sync Hook
  useEffect(() => {
    if (!tourId) return;

    let sse: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function connect() {
      sse = new EventSource(`/api/bill-splits/tours/${tourId}/sync`);

      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'ITINERARY_CHANGE') {
            mutateItinerary();
          } else if (
            payload.type === 'CHECKLIST_CHANGE' ||
            payload.type === 'ITEM_CREATE' ||
            payload.type === 'ITEM_MUTATE' ||
            payload.type === 'TOGGLE_PACKED' ||
            payload.type === 'CATEGORY_CHANGE'
          ) {
            mutateChecklist();
          }
        } catch (err) {
          // ignore parsing error
        }
      };

      sse.onerror = () => {
        if (sse) sse.close();
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (sse) sse.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [tourId, mutateItinerary, mutateChecklist]);

  const uniqueGroupTitles = useMemo(() => {
    const titles = new Set<string>();
    itinerary.forEach((item) => {
      if (item.groupTitle) {
        titles.add(item.groupTitle);
      }
    });
    return Array.from(titles);
  }, [itinerary]);

  const filteredGroupSuggestions = useMemo(() => {
    const query = itinGroupTitle.toLowerCase().trim();
    if (!query) return uniqueGroupTitles;
    return uniqueGroupTitles.filter(t => t.toLowerCase().includes(query));
  }, [itinGroupTitle, uniqueGroupTitles]);

  const groupedItinerary = useMemo<[string, ItineraryItem[]][]>(() => {
    const groups = new Map<string, ItineraryItem[]>();
    itinerary.forEach((item) => {
      const groupName = item.groupTitle?.trim() || 'General Activities';
      groups.set(groupName, [...(groups.get(groupName) ?? []), item]);
    });
    return Array.from(groups.entries());
  }, [itinerary]);

  const handleToggleAssignee = (name: string) => {
    if (name === 'Everyone') {
      setSelectedAssignees(['Everyone']);
    } else {
      let updated = selectedAssignees.filter(a => a !== 'Everyone');
      if (updated.includes(name)) {
        updated = updated.filter(a => a !== name);
      } else {
        updated.push(name);
      }
      if (updated.length === 0) {
        updated = ['Everyone'];
      }
      setSelectedAssignees(updated);
    }
  };

  const handleAddItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itinTitle.trim()) return;

    const groupTitle = itinGroupTitle.trim() || 'General Activities';

    const formData = new FormData();
    formData.append('title', itinTitle.trim());
    formData.append('day', String(itinDay));
    formData.append('time', itinTime);
    formData.append('location', itinLocation.trim());
    formData.append('cost', itinCost.trim());
    formData.append('type', itinType);
    formData.append('notes', itinNotes.trim());
    formData.append('groupTitle', groupTitle);
    if (itinAttachment) {
      formData.append('file', itinAttachment);
    }

    const optimisticItem: ItineraryItem = {
      id: 'temp_' + Date.now(),
      day: itinDay,
      time: itinTime,
      title: itinTitle.trim(),
      location: itinLocation.trim(),
      cost: itinCost.trim() || undefined,
      type: itinType,
      notes: itinNotes.trim() || undefined,
      groupTitle,
      attachmentName: itinAttachment ? itinAttachment.name : undefined,
    };

    const previous = itinerary;
    const sorted = [...itinerary, optimisticItem].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.time.localeCompare(b.time);
    });

    mutateItinerary({ success: true, itinerary: sorted }, { revalidate: false });

    setItinTitle('');
    setItinLocation('');
    setItinCost('');
    setItinNotes('');
    setItinGroupTitle('');
    setItinAttachment(null);
    if (itinFileInputRef.current) itinFileInputRef.current.value = '';
    setIsAddingItinerary(false);
    haptics.success();

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/itinerary`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();
      mutateItinerary();
    } catch {
      mutateItinerary({ success: true, itinerary: previous }, { revalidate: true });
    }
  };

  const handleDeleteItinerary = async (id: string) => {
    const previous = itinerary;
    mutateItinerary({ success: true, itinerary: itinerary.filter(item => item.id !== id) }, { revalidate: false });
    haptics.tap();

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/itinerary?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      mutateItinerary();
    } catch {
      mutateItinerary({ success: true, itinerary: previous }, { revalidate: true });
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkName.trim()) return;

    const assignedToStr = selectedAssignees.join(', ');

    const formData = new FormData();
    formData.append('name', checkName.trim());
    formData.append('category', checkCategory);
    formData.append('assignedTo', assignedToStr);
    formData.append('description', checkDescription.trim());
    if (checkAttachment) {
      formData.append('file', checkAttachment);
    }

    const optimisticItem: ChecklistItem = {
      id: 'temp_' + Date.now(),
      name: checkName.trim(),
      category: checkCategory,
      assignedTo: assignedToStr,
      completed: false,
      description: checkDescription.trim() || undefined,
      attachmentName: checkAttachment ? checkAttachment.name : undefined,
    };

    const previous = checklist;
    mutateChecklist({ success: true, checklist: [...checklist, optimisticItem], categories: customCategoriesList }, { revalidate: false });

    setCheckName('');
    setCheckCategory('Other');
    setSelectedAssignees(['Everyone']);
    setCheckDescription('');
    setCheckAttachment(null);
    if (checkFileInputRef.current) checkFileInputRef.current.value = '';
    setIsAddingChecklist(false);
    haptics.success();

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/checklist`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();
      mutateChecklist();
    } catch {
      mutateChecklist({ success: true, checklist: previous, categories: customCategoriesList }, { revalidate: true });
    }
  };

  const handleToggleChecklist = async (id: string) => {
    const item = checklist.find(i => i.id === id);
    if (!item) return;

    const newCompleted = !item.completed;
    const previous = checklist;
    const updated = checklist.map(i => i.id === id ? { ...i, completed: newCompleted } : i);
    mutateChecklist({ success: true, checklist: updated, categories: customCategoriesList }, { revalidate: false });
    haptics.tap();

    const formData = new FormData();
    formData.append('id', String(id));
    formData.append('completed', String(newCompleted));

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/checklist`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();
      mutateChecklist();
    } catch {
      mutateChecklist({ success: true, checklist: previous, categories: customCategoriesList }, { revalidate: true });
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    const previous = checklist;
    mutateChecklist({ success: true, checklist: checklist.filter(item => item.id !== id), categories: customCategoriesList }, { revalidate: false });
    haptics.tap();

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/checklist?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      mutateChecklist();
    } catch {
      mutateChecklist({ success: true, checklist: previous, categories: customCategoriesList }, { revalidate: true });
    }
  };

  const handleAddCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomCategory.trim()) return;

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/checklist/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomCategory.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewCustomCategory('');
      setShowCustomCatInput(false);
      mutateChecklist();
      haptics.success();
    } catch {
      // ignore error
    }
  };

  const generateDefaultChecklist = async () => {
    const defaults = [
      { name: 'Passports & Visas', category: 'Documents', assignedTo: 'Everyone' },
      { name: 'Flight & Hotel Bookings', category: 'Documents', assignedTo: 'Everyone' },
      { name: 'Local Currency / Cards', category: 'Documents', assignedTo: 'Everyone' },
      { name: 'Phone Chargers & Power Banks', category: 'Electronics', assignedTo: 'Everyone' },
      { name: 'Universal Travel Adapter', category: 'Electronics', assignedTo: 'Everyone' },
      { name: 'Toothbrush & Travel Toiletries', category: 'Toiletries', assignedTo: 'Everyone' },
      { name: 'First-aid & Daily Medicines', category: 'Other', assignedTo: 'Everyone' },
      { name: 'Weather-appropriate Clothes', category: 'Clothing', assignedTo: 'Everyone' },
    ];

    try {
      for (const item of defaults) {
        const formData = new FormData();
        formData.append('name', item.name);
        formData.append('category', item.category);
        formData.append('assignedTo', item.assignedTo);
        await fetch(`/api/bill-splits/tours/${tourId}/checklist`, {
          method: 'POST',
          body: formData,
        });
      }
      mutateChecklist();
      haptics.success();
    } catch {
      // ignore
    }
  };

  // Destructure computed metrics out of the API response to save client CPU
  const totalSpent = Number(tourData?.totalSpent || 0);
  const perPerson = Number(tourData?.perPerson || 0);
  const averageCost = Number(tourData?.averageCost || 0);
  const balances = useMemo(() => (tourData?.balances ?? []) as TourParticipant[], [tourData?.balances]);

  const currentUserBalanceObj = balances.find(b => b.userId === currentUserId);
  const myBalance = currentUserBalanceObj?.balance || 0;

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const tickColor = isDark ? '#8b949e' : '#6b7280';
  const gridColor = isDark ? '#21262d' : '#e5e7eb';

  const barData = useMemo(() => {
    if (transactions.length === 0) {
      return { labels: [], datasets: [] };
    }

    const dailyCatMap = new Map<string, Map<string, number>>();
    const categoriesSet = new Set<string>();

    transactions.forEach(t => {
      const date = t.date || 'Unknown';
      if (date === 'Unknown') return;
      const cat = t.category || 'Other';
      const formattedCat = cat.trim().charAt(0).toUpperCase() + cat.trim().slice(1).toLowerCase();
      categoriesSet.add(formattedCat);

      if (!dailyCatMap.has(date)) {
        dailyCatMap.set(date, new Map<string, number>());
      }
      const catMap = dailyCatMap.get(date)!;
      catMap.set(formattedCat, (catMap.get(formattedCat) || 0) + Number(t.amount));
    });

    const sortedDates = Array.from(dailyCatMap.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const uniqueCategories = Array.from(categoriesSet);

    const datasets = uniqueCategories.map(cat => {
      const data = sortedDates.map(date => {
        return dailyCatMap.get(date)?.get(cat) || 0;
      });

      const hexColor = getCategoryHex ? getCategoryHex(cat, customCategories) : '#136dec';

      return {
        label: cat,
        data,
        backgroundColor: hexColor,
        borderRadius: 4,
        borderSkipped: false as const
      };
    });

    return {
      labels: sortedDates.map(d => {
        const [year, month, day] = d.split('-');
        const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets
    };
  }, [transactions, customCategories]);

  const contributionData = useMemo(() => {
    const activeBalances = balances.filter(b => (b.paid || 0) > 0);
    const labels = activeBalances.map(b => b.name);
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#06b6d4', '#14b8a6', '#ec4899', '#0ea5e9'];
    
    return {
      labels,
      datasets: [{
        data: activeBalances.map(b => b.paid || 0),
        backgroundColor: activeBalances.map((_, i) => colors[i % colors.length]),
        borderWidth: 0,
        spacing: 2,
      }]
    };
  }, [balances]);

  const settlementPlan = useMemo(() => {
    if (!balances || balances.length === 0) return [];
    
    const debtors = balances
      .filter(b => (b.balance ?? 0) < -0.01)
      .map(b => ({ ...b, balance: b.balance ?? 0 }))
      .sort((a, b) => a.balance - b.balance);
      
    const creditors = balances
      .filter(b => (b.balance ?? 0) > 0.01)
      .map(b => ({ ...b, balance: b.balance ?? 0 }))
      .sort((a, b) => b.balance - a.balance);
      
    const plans: { from: string; to: string; amount: number }[] = [];
    let dIdx = 0;
    let cIdx = 0;
    
    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      
      const oweAmount = -debtor.balance;
      const creditAmount = creditor.balance;
      const transfer = Math.min(oweAmount, creditAmount);
      
      plans.push({
        from: debtor.name,
        to: creditor.name,
        amount: transfer
      });
      
      debtor.balance += transfer;
      creditor.balance -= transfer;
      
      if (Math.abs(debtor.balance) < 0.01) dIdx++;
      if (Math.abs(creditor.balance) < 0.01) cIdx++;
    }
    
    return plans;
  }, [balances]);

  const doughnutData = useMemo(() => {
    const catMap = new Map<string, number>();
    transactions.forEach(t => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + Number(t.amount));
    });
    const labels = Array.from(catMap.keys());
    return {
        labels: labels.map(c => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()),
        datasets: [{
            data: labels.map(l => catMap.get(l)),
            backgroundColor: labels.map(c => getCategoryHex ? getCategoryHex(c.charAt(0).toUpperCase() + c.slice(1).toLowerCase(), customCategories) : '#136dec'),
            borderWidth: 0,
            spacing: 2,
        }],
    };
  }, [transactions, customCategories]);

  const participantMap = useMemo(() => {
    return new Map(participants.map((participant) => [participant.id, participant.name]));
  }, [participants]);

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (selectedCategory !== 'All') {
      list = list.filter(t => t.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase());
    }
    return list;
  }, [transactions, selectedCategory]);

  const limitedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleTransactionsLimit);
  }, [filteredTransactions, visibleTransactionsLimit]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, TourTransaction[]>();
    limitedTransactions.forEach((transaction) => {
      const key = transaction.date || 'Unknown date';
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });
    return Array.from(groups.entries());
  }, [limitedTransactions]);

  const uniqueTxCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach(t => {
      if (t.category) {
        cats.add(t.category.trim().charAt(0).toUpperCase() + t.category.trim().slice(1).toLowerCase());
      }
    });
    return ['All', ...Array.from(cats)];
  }, [transactions]);

  const handleShareClick = useCallback(async () => {
    setIsShareModalOpen(true);
    if (inviteUrl) return;

    setIsGeneratingInvite(true);
    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/invite`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.success && data.inviteUrl) {
        setInviteUrl(data.inviteUrl);
      }
    } catch {
      // Silently fail
    } finally {
      setIsGeneratingInvite(false);
    }
  }, [tourId, inviteUrl]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) return;
    const fullUrl = `${window.location.origin}${inviteUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [inviteUrl]);

  const handleDeleteTransaction = async (tx: TourTransaction) => {
    if (!confirm('Are you sure you want to delete this cost?')) return;

    const updatedTransactions = (rawTransactions ?? []).filter((t) => t.id !== tx.id);
    const expectedData = {
      ...tourData,
      transactions: updatedTransactions,
    };

    try {
      await mutateTour(
        fetch(`/api/bill-splits/tours/${tour?.id}/spendings/${tx.id}`, { method: 'DELETE' })
          .then(async (res) => {
            if (!res.ok) throw new Error('Delete failed');
            return expectedData;
          }),
        {
          optimisticData: expectedData,
          rollbackOnError: true,
          populateCache: true,
          revalidate: true,
        }
      );
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'));
    } catch (e) {
      console.error(e);
    }
  };

  const getParticipantName = useCallback((id?: number) => {
    if (id === undefined) return 'Unknown';
    return participantMap.get(id) ?? 'Unknown';
  }, [participantMap]);

  if (isLoading) return <TourSpendingsSkeleton />;

  if (error || !tour) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-3xl items-center px-4 py-8 sm:px-6">
        <div className="glass-panel w-full rounded-[2rem] p-8 text-center">
          <span className="material-symbols-outlined mb-3 text-5xl text-rose-400">travel_explore</span>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Tour could not load</h1>
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">{error ?? 'Tour not found.'}</p>
          <Link href="/tours" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Tours
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto min-h-dvh max-w-7xl px-4 py-2 pb-20 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <Link href="/tours" className="mb-4 inline-flex items-center gap-2 rounded-2xl text-sm font-bold text-gray-500 hover:text-gray-950 dark:hover:text-white">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Tours
            </Link>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-primary">Tour Dashboard</p>
            <h1 className="max-w-4xl text-balance text-3xl font-black tracking-tight text-gray-950 dark:text-white lg:text-5xl">
              {tour.name}
            </h1>
            {dashboardData && (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Balance: <span className="font-bold text-gray-950 dark:text-white">{fmt(dashboardData.balance)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Earnings: <span className="font-bold text-gray-950 dark:text-white">{fmt(dashboardData.earnings.current)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Expenses: <span className="font-bold text-gray-950 dark:text-white">{fmt(dashboardData.expenses.current)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Net Savings: <span className="font-bold text-gray-950 dark:text-white">{fmt(dashboardData.netSavings)}</span>
                </span>
              </div>
            )}
          </motion.div>

          <div className="flex items-center gap-3">
            {tour.createdBy === currentUserId && (
              <motion.button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/50 px-5 py-3.5 text-sm font-black text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
                Edit Tour
              </motion.button>
            )}
            <motion.button
              type="button"
              onClick={handleShareClick}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3.5 text-sm font-black text-primary hover:bg-primary/15 dark:border-primary/30"
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
              Share Trip
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.22)] hover:bg-primary-hover"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
              Add Cost
            </motion.button>
          </div>
        </div>

        <div className="-mx-4 mb-8 flex flex-nowrap gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 md:gap-4 md:overflow-visible lg:gap-5 stagger-children">
          <TiltCard className="glass-panel stat-gradient-blue min-w-[10.5rem] flex-[0_0_10.5rem] p-4 rounded-3xl relative overflow-hidden group breathe md:min-w-0 md:flex-1 lg:p-6" style={{ animationDelay: '0s', animation: 'slideUp 0.5s ease-out 0s both' }}>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="whitespace-nowrap text-gray-500 dark:text-text-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">Total Spent</p>
                <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight number-appear">{fmt(totalSpent)}</h3>
            </div>
          </TiltCard>
          <TiltCard className="glass-panel stat-gradient-emerald min-w-[10.5rem] flex-[0_0_10.5rem] p-4 rounded-3xl relative overflow-hidden group breathe md:min-w-0 md:flex-1 lg:p-6" style={{ animationDelay: '0.08s', animation: 'slideUp 0.5s ease-out 0.08s both' }}>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="whitespace-nowrap text-gray-500 dark:text-text-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">Per Person</p>
                <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight number-appear">{fmt(perPerson)}</h3>
            </div>
          </TiltCard>
          <TiltCard className="glass-panel stat-gradient-orange min-w-[10.5rem] flex-[0_0_10.5rem] p-4 rounded-3xl relative overflow-hidden group breathe md:min-w-0 md:flex-1 lg:p-6" style={{ animationDelay: '0.16s', animation: 'slideUp 0.5s ease-out 0.16s both' }}>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="whitespace-nowrap text-gray-500 dark:text-text-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">Avg Cost</p>
                <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight number-appear">{fmt(averageCost)}</h3>
            </div>
          </TiltCard>
          <TiltCard className={`glass-panel ${myBalance >= 0 ? 'stat-gradient-blue' : 'stat-gradient-rose'} min-w-[10.5rem] flex-[0_0_10.5rem] p-4 rounded-3xl relative overflow-hidden group breathe md:min-w-0 md:flex-1 lg:p-6`} style={{ animationDelay: '0.24s', animation: 'slideUp 0.5s ease-out 0.24s both' }}>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="whitespace-nowrap text-gray-500 dark:text-text-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">My Balance</p>
                <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight number-appear">
                  {myBalance > 0 ? '+' : myBalance < 0 ? '-' : ''}{fmt(Math.abs(myBalance))}
                </h3>
            </div>
          </TiltCard>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8 flex flex-wrap gap-2 border-b border-gray-200 dark:border-white/10 pb-4">
          {[
            { id: 'ledger', label: 'Expenses Ledger', icon: 'receipt_long' },
            { id: 'itinerary', label: 'Itinerary Planner', icon: 'calendar_month' },
            { id: 'checklist', label: 'Packing Checklist', icon: 'backpack' },
            { id: 'settlements', label: 'Balances & Settlements', icon: 'handshake' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { haptics.tap(); setActiveTab(tab.id as any); }}
                className={`relative flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all outline-none ${
                  isActive ? 'text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute inset-0 rounded-2xl bg-primary shadow-lg shadow-primary/20"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'ledger' && (
            <motion.div
              key="ledger-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={spring}
              className="space-y-8"
            >
              {/* Split-Screen Analytics: Spending Trends & Expense Distribution */}
              <div className="flex flex-col lg:flex-row gap-5">
                  <TiltCard className="w-full lg:w-[60%] shrink-0 glass-panel p-6 rounded-3xl ambient-glow" style={{ animation: 'none' }}>
                      <div className="flex justify-between items-center mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Spending Trends</h3>
                              <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">Tour expenses over time</p>
                          </div>
                      </div>
                      <div className="h-[320px]">
                          <Bar data={barData!} options={{
                              responsive: true, maintainAspectRatio: false,
                              plugins: {
                                  legend: { position: 'top' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12, weight: 500 } } },
                                  tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 12, cornerRadius: 8 },
                              },
                              scales: {
                                  x: { stacked: true, grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 8, font: { size: 11 }, padding: 10 } },
                                  y: { stacked: true, beginAtZero: true, grid: { color: gridColor, lineWidth: 0.5 }, ticks: { color: tickColor, callback: (v) => fmt(Number(v)), font: { size: 11 }, padding: 8 }, border: { display: false } },
                              },
                          }} />
                      </div>
                  </TiltCard>

                  <TiltCard className="w-full lg:w-[40%] glass-panel p-6 rounded-3xl ambient-glow" style={{ animation: 'none' }} tiltIntensity={7.5}>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Expense Distribution</h3>
                      <div className="h-[320px] min-h-[160px]">
                          <Doughnut data={doughnutData!} options={{
                              responsive: true, maintainAspectRatio: false,
                              animation: { duration: 800, easing: 'easeOutQuart' },
                              plugins: {
                                  legend: { position: 'bottom' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 10, font: { size: 11 } } },
                                  tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 10, cornerRadius: 8 },
                              },
                              cutout: '68%',
                          }} />
                      </div>
                  </TiltCard>
              </div>

              {/* Injected Balances Overview */}
              <div className="mt-8">
                <h3 className="text-xl font-black text-gray-950 dark:text-white mb-4">Balances Overview</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {balances.map((participant) => (
                    <div key={participant.id} className="rounded-2xl border border-gray-200 bg-white/60 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                      <h3 className="truncate text-lg font-black text-gray-950 dark:text-white">{participant.name}</h3>
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                        Paid {fmt(participant.paid || 0)}
                      </p>
                      <p className={`mt-3 text-lg font-black ${(participant.balance || 0) > 0 ? 'text-emerald-500' : (participant.balance || 0) < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                        {(participant.balance || 0) > 0
                          ? `Gets back ${fmt(participant.balance || 0)}`
                          : (participant.balance || 0) < 0
                            ? `Owes ${fmt(Math.abs(participant.balance || 0))}`
                            : 'Settled'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transactions Ledger */}
              <div className="mt-10">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-black text-gray-950 dark:text-white">Transactions Ledger</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-400">Filter Category:</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => { haptics.tap(); setSelectedCategory(e.target.value); setVisibleTransactionsLimit(15); }}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 dark:border-white/10 dark:bg-[#111827] dark:text-white outline-none"
                    >
                      {uniqueTxCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <AnimatePresence mode="popLayout">
                  {filteredTransactions.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={spring}
                      className="glass-panel flex min-h-72 flex-col items-center justify-center rounded-[2rem] p-8 text-center"
                    >
                      <span className="material-symbols-outlined mb-4 text-6xl text-gray-300 dark:text-gray-600">receipt_long</span>
                      <h2 className="text-2xl font-black text-gray-950 dark:text-white">No costs logged yet</h2>
                      <p className="mt-2 max-w-md text-sm font-medium text-gray-500 dark:text-gray-400">
                        {selectedCategory !== 'All' ? 'No transactions found matching this category.' : 'Add the first meal, ride, hotel bill, or shared purchase for this trip.'}
                      </p>
                      {selectedCategory === 'All' && (
                        <button
                          type="button"
                          onClick={() => setIsAddModalOpen(true)}
                          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
                          Add First Cost
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="feed" layout className="space-y-6">
                      {groupedTransactions.map(([date, items], groupIndex) => (
                        <motion.section
                          key={date}
                          layout
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring, delay: groupIndex * 0.04 }}
                        >
                          <div className="mb-3 flex items-center gap-3">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                              {date === 'Unknown date' ? date : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                          </div>

                          <div className="space-y-3">
                            {items.map((transaction, index) => {
                              const payerId = transaction.paidByParticipantId ?? transaction.paidBy;
                              const payerName = transaction.paidByName ?? getParticipantName(payerId);

                              return (
                                <motion.article
                                  layoutId={`tour-transaction-${transaction.id}`}
                                  key={transaction.id}
                                  onClick={() => { setSelectedTransaction(transaction); setIsDetailModalOpen(true); }}
                                  initial={{ opacity: 0, x: -14 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  whileHover={{ y: -2 }}
                                  transition={{ ...spring, delay: index * 0.025 }}
                                  className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white/78 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-2xl transition-all hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex min-w-0 items-center gap-4">
                                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                                        <span className="material-symbols-outlined">
                                          {getCategoryIcon(transaction.category, customCategories)}
                                        </span>
                                      </div>
                                      <div className="min-w-0">
                                        <h2 className="truncate text-base font-black text-gray-950 dark:text-white">{transaction.description}</h2>
                                        <p className="mt-1 truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                                          {transaction.createdByName && transaction.createdByName !== payerName ? (
                                            <>Paid by <span className="text-gray-800 dark:text-gray-200">{payerName}</span> (Added by {transaction.createdByName})</>
                                          ) : (
                                            <>Paid by <span className="text-gray-800 dark:text-gray-200">{payerName}</span></>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-4">
                                      <div className="text-right">
                                        <p className="text-xl font-black tabular-nums text-rose-500">-{fmt(transaction.amount)}</p>
                                        <span className="mt-1 inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 dark:border-white/10 dark:bg-white/[0.04]">
                                          {transaction.splitType}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 border-l border-gray-200 dark:border-white/10 pl-4">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setSelectedTransaction(transaction); setIsEditCostOpen(true); }}
                                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:bg-white/[0.04] dark:hover:bg-white/10 dark:hover:text-white"
                                          title="Edit"
                                        >
                                          <span className="material-symbols-outlined text-[20px]">edit</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); void handleDeleteTransaction(transaction); }}
                                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
                                          title="Delete"
                                        >
                                          <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.article>
                              );
                            })}
                          </div>
                        </motion.section>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                {filteredTransactions.length > visibleTransactionsLimit && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => { haptics.tap(); setVisibleTransactionsLimit(prev => prev + 15); }}
                      className="rounded-2xl border border-gray-200 bg-white/50 px-6 py-3 text-sm font-black text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/10"
                    >
                      Show More
                    </button>
                  </div>
                )}
              </div>

              {/* Member Contributions Doughnut Chart */}
              {balances.some(b => (b.paid || 0) > 0) && (
                <motion.section
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[2rem] border border-gray-200 bg-white/80 p-7 shadow-[0_20px_65px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.02] mt-10"
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-gray-950 dark:text-white">Member Contributions</h2>
                    <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Breakdown of total money paid by each member of the trip.
                    </p>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-8 items-center">
                    <div className="w-full lg:w-[45%] h-[240px] flex items-center justify-center">
                      <Doughnut data={contributionData!} options={{
                        responsive: true, maintainAspectRatio: false,
                        animation: { duration: 800, easing: 'easeOutQuart' },
                        plugins: {
                          legend: { position: 'bottom' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 8, font: { size: 11 } } },
                          tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: (c) => `Paid: ${fmt(Number(c.raw))}` } },
                        },
                        cutout: '68%',
                      }} />
                    </div>
                    <div className="w-full lg:w-[55%] space-y-3">
                      {balances
                        .filter(b => (b.paid || 0) > 0)
                        .sort((a, b) => (b.paid || 0) - (a.paid || 0))
                        .map((b, i) => {
                          const totalPaid = balances.reduce((sum, item) => sum + (item.paid || 0), 0);
                          const percent = totalPaid > 0 ? Math.round(((b.paid || 0) / totalPaid) * 100) : 0;
                          const colors = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#06b6d4', '#14b8a6', '#ec4899', '#0ea5e9'];
                          const dotColor = colors[i % colors.length];
                          return (
                            <div key={b.id} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
                              <div className="flex items-center gap-2.5">
                                <div className="size-3 rounded-full" style={{ backgroundColor: dotColor }} />
                                <span className="text-sm font-black text-gray-950 dark:text-white">{b.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-mono font-black text-gray-900 dark:text-gray-200">{fmt(b.paid || 0)}</span>
                                <span className="ml-2.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-bold">{percent}%</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </motion.section>
              )}
            </motion.div>
          )}

          {activeTab === 'itinerary' && (
            <motion.div
              key="itinerary-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={spring}
              className="space-y-6"
            >
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-gray-950 dark:text-white">Trip Itinerary</h2>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                      Plan and view your day-by-day activities, reservations, and timings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { haptics.tap(); setIsAddingItinerary(!isAddingItinerary); }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-primary-hover self-start sm:self-auto"
                  >
                    <span className="material-symbols-outlined text-[18px]">{isAddingItinerary ? 'close' : 'add'}</span>
                    {isAddingItinerary ? 'Cancel' : 'Add Activity'}
                  </button>
                </div>

                <AnimatePresence>
                  {isAddingItinerary && (
                    <motion.form
                      onSubmit={handleAddItinerary}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-gray-100 dark:border-white/5 pt-6 mt-4 space-y-4 overflow-hidden"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                        <div ref={itinGroupInputRef} className="relative">
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Group Category Title</label>
                          <input
                            type="text"
                            value={itinGroupTitle}
                            onFocus={() => setShowItinGroupSuggestions(true)}
                            onChange={e => { setItinGroupTitle(e.target.value); setShowItinGroupSuggestions(true); }}
                            placeholder="e.g. Day 1, Day 1 (30 July)"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                          {showItinGroupSuggestions && filteredGroupSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-900">
                              {filteredGroupSuggestions.map(suggestion => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => { setItinGroupTitle(suggestion); setShowItinGroupSuggestions(false); }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Activity Title</label>
                          <input
                            type="text"
                            required
                            value={itinTitle}
                            onChange={e => setItinTitle(e.target.value)}
                            placeholder="e.g. Eiffel Tower Visit"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Day Number</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={itinDay}
                            onChange={e => setItinDay(Number(e.target.value))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Time</label>
                          <input
                            type="time"
                            required
                            value={itinTime}
                            onChange={e => setItinTime(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary [color-scheme:dark]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Location</label>
                          <input
                            type="text"
                            value={itinLocation}
                            onChange={e => setItinLocation(e.target.value)}
                            placeholder="e.g. Paris, France"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Estimated Cost (Optional)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={itinCost}
                            onChange={e => setItinCost(e.target.value)}
                            placeholder="0.00"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Type</label>
                          <select
                            value={itinType}
                            onChange={e => setItinType(e.target.value as any)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          >
                            <option value="activity">Activity 🎯</option>
                            <option value="flight">Flight ✈️</option>
                            <option value="hotel">Hotel 🏨</option>
                            <option value="food">Food 🍽️</option>
                            <option value="transport">Transport 🚗</option>
                            <option value="other">Other 📦</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Notes</label>
                          <textarea
                            value={itinNotes}
                            onChange={e => setItinNotes(e.target.value)}
                            placeholder="Confirmation codes, reminders, reservation links..."
                            className="mt-1 min-h-16 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">File Attachment (Optional)</label>
                          <input
                            ref={itinFileInputRef}
                            type="file"
                            onChange={e => setItinAttachment(e.target.files?.[0] || null)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white shadow-md hover:bg-primary-hover"
                      >
                        <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
                        Save Activity
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              {itinerary.length === 0 ? (
                <div className="glass-panel flex min-h-72 flex-col items-center justify-center rounded-3xl p-8 text-center">
                  <span className="material-symbols-outlined mb-4 text-6xl text-gray-300 dark:text-gray-600">route</span>
                  <h3 className="text-xl font-black text-gray-950 dark:text-white">Your itinerary is empty</h3>
                  <p className="mt-2 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">
                    Start planning your trip schedule by adding flight timings, hotel stays, and exciting activities!
                  </p>
                  <button
                    type="button"
                    onClick={() => { haptics.tap(); setIsAddingItinerary(true); }}
                    className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Add First Activity
                  </button>
                </div>
              ) : (
                <div className="space-y-10">
                  {groupedItinerary.map(([groupName, items]) => {
                    const isExpanded = expandedGroups[groupName] ?? false;
                    const visibleItems = isExpanded ? items : items.slice(0, 5);
                    const showExpand = items.length > 5;

                    return (
                      <div key={groupName} className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-white/10 pb-2">
                          <span className="material-symbols-outlined text-[20px] text-primary">folder_open</span>
                          <h3 className="text-lg font-black text-gray-950 dark:text-white">{groupName}</h3>
                          <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-xs font-black text-gray-500 dark:text-gray-400">
                            {items.length} {items.length === 1 ? 'activity' : 'activities'}
                          </span>
                        </div>

                        <div className="relative border-l border-gray-200 dark:border-white/10 ml-6 pl-8 space-y-6 py-2">
                          {visibleItems.map((item, index) => {
                            const typeIcons: Record<string, string> = {
                              flight: 'flight_takeoff',
                              hotel: 'hotel',
                              food: 'restaurant',
                              activity: 'local_activity',
                              transport: 'directions_car',
                              other: 'category'
                            };
                            const icon = typeIcons[item.type] || 'category';
                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="relative group"
                              >
                                <div className="absolute -left-[50px] top-1.5 flex size-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300 transition-transform group-hover:scale-110">
                                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                </div>

                                <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition-all hover:translate-x-1 duration-200">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">
                                        Day {item.day}
                                      </span>
                                      <span className="text-sm font-mono font-bold text-gray-500 dark:text-gray-400">
                                        {item.time}
                                      </span>
                                      <h4 className="text-base font-black text-gray-950 dark:text-white">{item.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-3 self-end sm:self-auto">
                                      {item.cost && (
                                        <span className="text-sm font-mono font-black text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-lg">
                                          Est. {fmt(Number(item.cost))}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItinerary(item.id)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                                        title="Delete activity"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                      </button>
                                    </div>
                                  </div>

                                  {(item.location || item.notes || item.attachmentId) && (
                                    <div className="mt-2 space-y-1.5">
                                      {item.location && (
                                        <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-semibold">
                                          <span className="material-symbols-outlined text-[15px] text-gray-400">pin_drop</span>
                                          {item.location}
                                        </p>
                                      )}
                                      {item.notes && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 bg-white/[0.02] border border-white/[0.04] p-2 rounded-lg leading-relaxed italic">
                                          {item.notes}
                                        </p>
                                      )}
                                      {item.attachmentId && (
                                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-white/5">
                                          <span className="material-symbols-outlined text-[16px] text-gray-400">attachment</span>
                                          <a
                                            href={`/api/bill-splits/tours/${tourId}/attachments?attachmentToken=${encodeURIComponent(item.attachmentId)}&type=itinerary&download=1`}
                                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            {item.attachmentName || 'Download Attachment'}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        {showExpand && (
                          <div className="pl-14 pt-2">
                            <button
                              type="button"
                              onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !isExpanded }))}
                              className="inline-flex items-center gap-1.5 text-xs font-black text-primary hover:underline"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                              </span>
                              {isExpanded ? 'Show Less' : `Expand More (${items.length - 5} more)`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'checklist' && (() => {
            const categoriesList = Array.from(new Set(['All', 'Documents', 'Clothing', 'Electronics', 'Toiletries', 'Other', ...customCategoriesList.map((c: any) => c.name)]));
            return (
              <motion.div
                key="checklist-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={spring}
                className="space-y-6"
              >
                <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-gray-950 dark:text-white">Group Packing Checklist</h2>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                        Ensure nothing is left behind. Track items to pack and assign them to trip members.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {checklist.length === 0 && (
                        <button
                          type="button"
                          onClick={generateDefaultChecklist}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-xs font-black text-emerald-400 hover:bg-emerald-500/20"
                        >
                          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                          Generate Essentials
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { haptics.tap(); setIsAddingChecklist(!isAddingChecklist); }}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-primary-hover"
                      >
                        <span className="material-symbols-outlined text-[18px]">{isAddingChecklist ? 'close' : 'add'}</span>
                        {isAddingChecklist ? 'Cancel' : 'Add Item'}
                      </button>
                    </div>
                  </div>

                  {checklist.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/[0.04] dark:bg-white/[0.02]">
                      <div className="checklist-progress-label mb-2 flex items-center justify-between text-xs font-black uppercase">
                        <span>Progress</span>
                        <span>
                          {checklist.filter(c => c.completed).length} / {checklist.length} packed
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-white/10 h-2.5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(checklist.filter(c => c.completed).length / checklist.length) * 100}%` }}
                          className="bg-emerald-500 h-full rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {isAddingChecklist && (
                      <motion.form
                        onSubmit={handleAddChecklist}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-100 dark:border-white/5 pt-6 mt-4 space-y-4 overflow-hidden"
                      >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Item Name</label>
                            <input
                              type="text"
                              required
                              value={checkName}
                              onChange={e => setCheckName(e.target.value)}
                              placeholder="e.g. Passports, Chargers, Adapters"
                              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center ml-1">
                              <label className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">Category</label>
                              <button
                                type="button"
                                onClick={() => setShowCustomCatInput(!showCustomCatInput)}
                                className="text-[10px] font-black uppercase tracking-wider text-primary hover:underline"
                              >
                                {showCustomCatInput ? 'Cancel' : '+ Custom Category'}
                              </button>
                            </div>
                            {showCustomCatInput ? (
                              <div className="mt-1 flex gap-2">
                                <input
                                  type="text"
                                  value={newCustomCategory}
                                  onChange={e => setNewCustomCategory(e.target.value)}
                                  placeholder="New category..."
                                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-primary"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => handleAddCustomCategory(e as unknown as React.FormEvent)}
                                  className="rounded-xl bg-primary px-3 text-xs font-black text-white hover:bg-primary-hover"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <select
                                value={checkCategory}
                                onChange={e => setCheckCategory(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111827] px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary"
                              >
                                <option value="Documents">Documents 📄</option>
                                <option value="Clothing">Clothing 👕</option>
                                <option value="Electronics">Electronics 🔌</option>
                                <option value="Toiletries">Toiletries 🧴</option>
                                <option value="Other">Other 📦</option>
                                {customCategoriesList.map(cat => (
                                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div ref={assigneeDropdownRef} className="relative">
                            <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Assigned To</label>
                            <button
                              type="button"
                              onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111827] px-4 py-3 text-sm font-bold text-gray-900 dark:text-white text-left outline-none focus:border-primary flex justify-between items-center"
                            >
                              <span className="truncate">{selectedAssignees.join(', ')}</span>
                              <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                            </button>
                            {showAssigneeDropdown && (
                              <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2.5 shadow-lg dark:border-white/10 dark:bg-slate-900 space-y-1">
                                <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedAssignees.includes('Everyone')}
                                    onChange={() => handleToggleAssignee('Everyone')}
                                    className="rounded border-gray-300 dark:border-white/20 bg-gray-50 text-primary focus:ring-primary"
                                  />
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Everyone</span>
                                </label>
                                {participants.map(p => (
                                  <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={selectedAssignees.includes(p.name)}
                                      onChange={() => handleToggleAssignee(p.name)}
                                      className="rounded border-gray-300 dark:border-white/20 bg-gray-50 text-primary focus:ring-primary"
                                    />
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{p.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Description (Optional)</label>
                            <textarea
                              value={checkDescription}
                              onChange={e => setCheckDescription(e.target.value)}
                              placeholder="Enter item details, sizes, quantities, or instructions..."
                              className="mt-1 min-h-16 w-full resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Attachment (Optional)</label>
                            <input
                              ref={checkFileInputRef}
                              type="file"
                              onChange={e => setCheckAttachment(e.target.files?.[0] || null)}
                              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-gray-950 dark:text-white outline-none focus:border-primary"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white shadow-md hover:bg-primary-hover"
                        >
                          <span className="material-symbols-outlined text-[20px]">playlist_add</span>
                          Add Checklist Item
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>

                {checklist.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {categoriesList.map(filter => (
                      <button
                        key={filter}
                        onClick={() => setActiveChecklistFilter(filter)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                          activeChecklistFilter === filter
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-gray-500 border border-transparent hover:bg-gray-100 dark:hover:bg-white/5 dark:text-gray-400'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                )}

                {checklist.length === 0 ? (
                  <div className="glass-panel flex min-h-72 flex-col items-center justify-center rounded-3xl p-8 text-center">
                    <span className="material-symbols-outlined mb-4 text-6xl text-gray-300 dark:text-gray-600">backpack</span>
                    <h3 className="text-xl font-black text-gray-950 dark:text-white">Your packing list is empty</h3>
                    <p className="mt-2 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">
                      Generate our recommended essential packing checklist, or add your own items below.
                    </p>
                    <button
                      type="button"
                      onClick={generateDefaultChecklist}
                      className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
                    >
                      <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                      Generate Essentials List
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {checklist
                      .filter(item => activeChecklistFilter === 'All' || item.category === activeChecklistFilter)
                      .map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.025 }}
                          onClick={() => handleToggleChecklist(item.id)}
                          className="glass-panel p-4 rounded-2xl cursor-pointer flex flex-col justify-between gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`size-6 rounded-lg border flex items-center justify-center transition-all ${
                                item.completed
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : 'border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-white/[0.02]'
                              }`}>
                                {item.completed && <span className="material-symbols-outlined text-[16px] font-bold">check</span>}
                              </div>
                              <div className="min-w-0">
                                <h4 className={`text-sm font-black truncate ${item.completed ? 'checklist-item-title is-completed line-through' : 'checklist-item-title'}`}>
                                  {item.name}
                                </h4>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span className="checklist-item-badge rounded px-1.5 py-0.5 text-[10px] font-black uppercase">
                                    {item.category}
                                  </span>
                                  <span className="checklist-item-assignee text-[10px] font-bold">
                                    👤 {item.assignedTo}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteChecklist(item.id); }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors shrink-0"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>

                          {(item.description || item.attachmentId) && (
                            <div className="mt-1 pl-9 space-y-2 border-t border-gray-100 dark:border-white/5 pt-2">
                              {item.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed italic">
                                  {item.description}
                                </p>
                              )}
                              {item.attachmentId && (
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[15px] text-gray-400">attachment</span>
                                  <a
                                    href={`/api/bill-splits/tours/${tourId}/attachments?attachmentToken=${encodeURIComponent(item.attachmentId)}&type=checklist&download=1`}
                                    className="text-xs font-black text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {item.attachmentName || 'Download Attachment'}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                  </div>
                )}
              </motion.div>
            );
          })()}

          {activeTab === 'settlements' && (
            <motion.div
              key="settlements-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={spring}
              className="space-y-8"
            >
              {/* Balances Overview — mirrored from Expenses Ledger tab (positioned at top) */}
              <div>
                <h3 className="text-xl font-black text-gray-950 dark:text-white mb-4">Balances Overview</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {balances.map((participant) => (
                    <div key={participant.id} className="rounded-2xl border border-gray-200 bg-white/60 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                      <h3 className="truncate text-lg font-black text-gray-950 dark:text-white">{participant.name}</h3>
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                        Paid {fmt(participant.paid || 0)}
                      </p>
                      <p className={`mt-3 text-lg font-black ${(participant.balance || 0) > 0 ? 'text-emerald-500' : (participant.balance || 0) < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                        {(participant.balance || 0) > 0
                          ? `Gets back ${fmt(participant.balance || 0)}`
                          : (participant.balance || 0) < 0
                            ? `Owes ${fmt(Math.abs(participant.balance || 0))}`
                            : 'Settled'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settlement Plan */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                <h3 className="text-xl font-black text-gray-950 dark:text-white mb-1">Settlement Plan</h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6">
                  Optimized payments to settle all group debts with the fewest transactions.
                </p>

                {settlementPlan.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <span className="material-symbols-outlined text-emerald-400 text-5xl mb-3">celebration</span>
                    <p className="text-base font-black text-gray-950 dark:text-white">All Settled!</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">No pending debts between members of this tour.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settlementPlan.map((plan, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm font-black text-rose-300 truncate max-w-[120px] sm:max-w-none text-center">
                            {plan.from}
                          </div>

                          <div className="flex-1 flex flex-col items-center min-w-[60px] relative px-2">
                            <span className="text-xs font-mono font-black text-gray-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full z-10 shrink-0">
                              {fmt(plan.amount)}
                            </span>
                            <div className="w-full border-t border-dashed border-gray-500 absolute top-1/2 -translate-y-1/2" />
                            <span className="material-symbols-outlined text-[16px] text-gray-500 absolute right-0 top-1/2 -translate-y-1/2 bg-slate-900 rounded-full pl-0.5">
                              play_arrow
                            </span>
                          </div>

                          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm font-black text-emerald-300 truncate max-w-[120px] sm:max-w-none text-center">
                            {plan.to}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${plan.from} paid ${fmt(plan.amount)} to ${plan.to}`);
                            haptics.tap();
                          }}
                          className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                          title="Copy settlement details"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Injected Member Contributions Doughnut Chart */}
              {balances.some(b => (b.paid || 0) > 0) && (
                <motion.section
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[2rem] border border-gray-200 bg-white/80 p-7 shadow-[0_20px_65px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.02] mt-10"
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-gray-950 dark:text-white">Member Contributions</h2>
                    <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Breakdown of total money paid by each member of the trip.
                    </p>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-8 items-center">
                    <div className="w-full lg:w-[45%] h-[240px] flex items-center justify-center">
                      <Doughnut data={contributionData!} options={{
                        responsive: true, maintainAspectRatio: false,
                        animation: { duration: 800, easing: 'easeOutQuart' },
                        plugins: {
                          legend: { position: 'bottom' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 8, font: { size: 11 } } },
                          tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: (c) => `Paid: ${fmt(Number(c.raw))}` } },
                        },
                        cutout: '68%',
                      }} />
                    </div>
                    <div className="w-full lg:w-[55%] space-y-3">
                      {balances
                        .filter(b => (b.paid || 0) > 0)
                        .sort((a, b) => (b.paid || 0) - (a.paid || 0))
                        .map((b, i) => {
                          const totalPaid = balances.reduce((sum, item) => sum + (item.paid || 0), 0);
                          const percent = totalPaid > 0 ? Math.round(((b.paid || 0) / totalPaid) * 100) : 0;
                          const colors = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#06b6d4', '#14b8a6', '#ec4899', '#0ea5e9'];
                          const dotColor = colors[i % colors.length];
                          return (
                            <div key={b.id} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
                              <div className="flex items-center gap-2.5">
                                <div className="size-3 rounded-full" style={{ backgroundColor: dotColor }} />
                                <span className="text-sm font-black text-gray-950 dark:text-white">{b.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-mono font-black text-gray-900 dark:text-gray-200">{fmt(b.paid || 0)}</span>
                                <span className="ml-2.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-bold">{percent}%</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </motion.section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TourAddCostModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setSelectedTransaction(null); }}
        participants={participants}
        tourId={Number(tourId)}
        currentUserId={currentUserId}
        isCreator={tour.createdBy === currentUserId}
        onSaveSuccess={() => {
          setIsAddModalOpen(false);
          setSelectedTransaction(null);
          void mutateTour();
        }}
      />

      <TourEditCostModal
        isOpen={isEditCostOpen}
        onClose={() => { setIsEditCostOpen(false); setSelectedTransaction(null); }}
        participants={participants}
        tourId={Number(tourId)}
        currentUserId={currentUserId}
        isCreator={tour.createdBy === currentUserId}
        transaction={selectedTransaction}
        onSaveSuccess={() => {
          setIsEditCostOpen(false);
          setSelectedTransaction(null);
          void mutateTour();
        }}
      />

      {isDetailModalOpen && (
        <TourTransactionDetailModal
          transaction={selectedTransaction}
          customCategories={customCategories}
          tourId={tour.id}
          onClose={() => { setIsDetailModalOpen(false); setSelectedTransaction(null); }}
          onEdit={(tx) => { 
            setIsDetailModalOpen(false); 
            setSelectedTransaction(tx); 
            setIsEditCostOpen(true); 
          }}
          onDelete={(tx) => { setIsDetailModalOpen(false); void handleDeleteTransaction(tx); }}
        />
      )}

      <TourEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        tourId={Number(tourId)}
        initialName={tour.name}
        initialParticipants={participants.map(p => ({ id: p.id, name: p.name, userId: p.userId }))}
        onSaveSuccess={() => { void mutateTour(); }}
      />

      {/* Share / Invite Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {isShareModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setIsShareModalOpen(false); setCopied(false); }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg z-40"
              />
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={spring}
                className="relative z-50 w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0A0E1A]/95 shadow-2xl backdrop-blur-xl p-6 sm:p-8"
              >
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Invite</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Share This Trip</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsShareModalOpen(false); setCopied(false); }}
                    className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                {isGeneratingInvite ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  </div>
                ) : inviteUrl ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-400">
                      Share this link with your trip members so they can join and track expenses together.
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 truncate rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-mono font-bold text-white">
                        {typeof window !== 'undefined' ? `${window.location.origin}${inviteUrl}` : inviteUrl}
                      </div>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.93 }}
                        transition={spring}
                        onClick={handleCopyLink}
                        className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black text-white transition-colors ${
                          copied ? 'bg-emerald-500' : 'bg-primary hover:bg-primary-hover'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                        {copied ? 'Copied!' : 'Copy'}
                      </motion.button>
                    </div>
                    <p className="text-xs font-medium text-gray-400">
                      Anyone with this link can join by selecting their participant name.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-400">
                      Generate an invite link to share with your trip members.
                    </p>
                    <button
                      type="button"
                      onClick={handleShareClick}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.25)] hover:bg-primary-hover"
                    >
                      <span className="material-symbols-outlined text-[20px]">link</span>
                      Generate Invite Link
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
