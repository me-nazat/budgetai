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
  timeEnd?: string | null;       // optional end time for a range like "09:00 – 12:00"
  title: string;
  location: string;
  cost?: string | number | null;
  costDisplay?: string | null;   // raw text range like "250-300" or "500"
  type: 'flight' | 'hotel' | 'food' | 'activity' | 'transport' | 'other';
  notes?: string;
  groupTitle?: string;
  attachmentId?: string;
  attachmentName?: string;
  status?: 'Planned' | 'Booked' | 'Completed';
  latitude?: string | null;
  longitude?: string | null;
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
  priority?: 'High' | 'Medium' | 'Low';
  quantity?: number;
  completedBy?: string | null;
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

function formatTime12h(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-emerald-500 text-white',
    'bg-teal-500 text-white',
    'bg-amber-500 text-white',
    'bg-rose-500 text-white',
    'bg-sky-500 text-white',
    'bg-blue-500 text-white',
    'bg-slate-500 text-white',
    'bg-orange-500 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function renderAssigneeAvatars(assigneeStr: string | null | undefined) {
  if (!assigneeStr) return null;
  const names = assigneeStr.split(',').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) return null;
  
  return (
    <div className="flex -space-x-1.5 overflow-hidden">
      {names.map((name, idx) => {
        const initials = getInitials(name);
        const colorClass = getAvatarColor(name);
        return (
          <div
            key={idx}
            title={name}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black uppercase ring-1 ring-white dark:ring-slate-900 shrink-0 ${colorClass}`}
          >
            {initials}
          </div>
        );
      })}
    </div>
  );
}

function parseCoordinates(input: string): { lat: string; lng: string } | null {
  if (!input) return null;
  const plainRegex = /^\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*$/;
  const plainMatch = input.match(plainRegex);
  if (plainMatch) {
    return { lat: plainMatch[1].trim(), lng: plainMatch[2].trim() };
  }
  const urlAtRegex = /@([0-9.-]+),([0-9.-]+)/;
  const urlAtMatch = input.match(urlAtRegex);
  if (urlAtMatch) {
    return { lat: urlAtMatch[1], lng: urlAtMatch[2] };
  }
  const urlQueryRegex = /[?&](query|q|ll)=([0-9.-]+),([0-9.-]+)/;
  const urlQueryMatch = input.match(urlQueryRegex);
  if (urlQueryMatch) {
    return { lat: urlQueryMatch[2], lng: urlQueryMatch[3] };
  }
  return null;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(distKm: number): string {
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)} m`;
  }
  return `${distKm.toFixed(1)} km`;
}

const hasCoords = (itm: any) => {
  return itm && itm.latitude && itm.longitude && !isNaN(parseFloat(itm.latitude)) && !isNaN(parseFloat(itm.longitude));
};

const getCompletedByArray = (completedByStr: string | null | undefined): string[] => {
  if (!completedByStr) return [];
  try {
    const parsed = JSON.parse(completedByStr);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return [];
};

const packingPresets = {
  beach: [
    { name: 'Swimwear', category: 'Clothing', priority: 'High', quantity: 2 },
    { name: 'Sunscreen (SPF 50+)', category: 'Toiletries', priority: 'High', quantity: 1 },
    { name: 'Sunglasses & Sun Hat', category: 'Clothing', priority: 'Medium', quantity: 1 },
    { name: 'Beach Towel', category: 'Other', priority: 'Medium', quantity: 1 },
    { name: 'Waterproof Phone Pouch', category: 'Electronics', priority: 'Low', quantity: 1 },
    { name: 'Flip Flops', category: 'Clothing', priority: 'Medium', quantity: 1 },
  ],
  winter: [
    { name: 'Heavy Coat / Parka', category: 'Clothing', priority: 'High', quantity: 1 },
    { name: 'Thermal Base Layers', category: 'Clothing', priority: 'High', quantity: 3 },
    { name: 'Woolen Socks & Gloves', category: 'Clothing', priority: 'High', quantity: 3 },
    { name: 'Lip Balm & Moisturizer', category: 'Toiletries', priority: 'Medium', quantity: 1 },
    { name: 'Beanie / Woolen Hat', category: 'Clothing', priority: 'Medium', quantity: 2 },
  ],
  adventure: [
    { name: 'Hiking Shoes', category: 'Clothing', priority: 'High', quantity: 1 },
    { name: 'Insect Repellent', category: 'Toiletries', priority: 'High', quantity: 1 },
    { name: 'First Aid Kit', category: 'Other', priority: 'High', quantity: 1 },
    { name: 'Reusable Water Bottle', category: 'Other', priority: 'High', quantity: 1 },
    { name: 'Flashlight / Headlamp', category: 'Electronics', priority: 'Medium', quantity: 1 },
    { name: 'Rain Jacket / Poncho', category: 'Clothing', priority: 'Medium', quantity: 1 },
  ],
  business: [
    { name: 'Formal Suits / Blazers', category: 'Clothing', priority: 'High', quantity: 2 },
    { name: 'Business Cards', category: 'Documents', priority: 'Medium', quantity: 50 },
    { name: 'Laptop & Charger', category: 'Electronics', priority: 'High', quantity: 1 },
    { name: 'Notebook & Pen', category: 'Other', priority: 'Low', quantity: 1 },
    { name: 'Passport & Travel Visa', category: 'Documents', priority: 'High', quantity: 1 },
  ],
  casual: [
    { name: 'Comfy Sneakers', category: 'Clothing', priority: 'High', quantity: 1 },
    { name: 'T-Shirts & Jeans', category: 'Clothing', priority: 'High', quantity: 5 },
    { name: 'Toothbrush & Paste', category: 'Toiletries', priority: 'High', quantity: 1 },
    { name: 'Phone Charger', category: 'Electronics', priority: 'High', quantity: 1 },
    { name: 'Deodorant / Cologne', category: 'Toiletries', priority: 'Medium', quantity: 1 },
    { name: 'Cash / Credit Cards', category: 'Documents', priority: 'High', quantity: 1 },
  ]
};

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
  const currentUserName = useMemo(() => {
    const p = participants.find(p => p.userId === currentUserId);
    return p ? p.name : (userData?.user?.name || 'Someone');
  }, [participants, currentUserId, userData]);
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
  const [ledgerSubTab, setLedgerSubTab] = useState<'transactions' | 'analytics' | 'balances'>('transactions');

  // Itinerary Planner state
  const { data: itineraryData, mutate: mutateItinerary } = useSWR<{ success: boolean; itinerary: ItineraryItem[] }>(
    tourId ? `/api/bill-splits/tours/${tourId}/itinerary` : null
  );
  const itinerary = useMemo(() => itineraryData?.itinerary ?? [], [itineraryData]);

  const estimatedTotal = useMemo(() => {
    return itinerary.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  }, [itinerary]);

  const [itinTitle, setItinTitle] = useState('');
  const [itinDay, setItinDay] = useState(1);
  const [itinTime, setItinTime] = useState('09:00');
  const [itinTimeEnd, setItinTimeEnd] = useState('');       // optional end time
  const [itinLocation, setItinLocation] = useState('');
  const [itinCost, setItinCost] = useState('');             // raw text: "500" or "250-300"
  const [itinType, setItinType] = useState<ItineraryItem['type']>('activity');
  const [itinNotes, setItinNotes] = useState('');
  const [itinGroupTitle, setItinGroupTitle] = useState('');
  const [itinAttachment, setItinAttachment] = useState<File | null>(null);
  const [itinStatus, setItinStatus] = useState<'Planned' | 'Booked' | 'Completed'>('Planned');
  const [showItinGroupSuggestions, setShowItinGroupSuggestions] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isAddingItinerary, setIsAddingItinerary] = useState(false);
  const [itinLatitude, setItinLatitude] = useState('');
  const [itinLongitude, setItinLongitude] = useState('');

  // Itinerary Filters
  const [itinFilterType, setItinFilterType] = useState<string>('All');
  const [itinSearchQuery, setItinSearchQuery] = useState<string>('');

  // Edit state — holds the item currently being edited (null = no edit in progress)
  const [editingItinItem, setEditingItinItem] = useState<ItineraryItem | null>(null);
  const [editItinTitle, setEditItinTitle] = useState('');
  const [editItinDay, setEditItinDay] = useState(1);
  const [editItinTime, setEditItinTime] = useState('09:00');
  const [editItinTimeEnd, setEditItinTimeEnd] = useState('');
  const [editItinLocation, setEditItinLocation] = useState('');
  const [editItinCost, setEditItinCost] = useState('');
  const [editItinType, setEditItinType] = useState<ItineraryItem['type']>('activity');
  const [editItinNotes, setEditItinNotes] = useState('');
  const [editItinGroupTitle, setEditItinGroupTitle] = useState('');
  const [editItinStatus, setEditItinStatus] = useState<'Planned' | 'Booked' | 'Completed'>('Planned');
  const [editItinAttachment, setEditItinAttachment] = useState<File | null>(null);
  const [isSavingItinEdit, setIsSavingItinEdit] = useState(false);
  const [showEditGroupSuggestions, setShowEditGroupSuggestions] = useState(false);
  const editGroupInputRef = useRef<HTMLDivElement>(null);
  const editItinFileInputRef = useRef<HTMLInputElement>(null);
  const [editItinLatitude, setEditItinLatitude] = useState('');
  const [editItinLongitude, setEditItinLongitude] = useState('');

  const [itinCoordsInput, setItinCoordsInput] = useState('');
  const [editItinCoordsInput, setEditItinCoordsInput] = useState('');

  const handleLocationChange = (val: string) => {
    setItinLocation(val);
    const parsed = parseCoordinates(val);
    if (parsed) {
      setItinLatitude(parsed.lat);
      setItinLongitude(parsed.lng);
      setItinCoordsInput(val);
    }
  };

  const handleCoordsInputChange = (val: string) => {
    setItinCoordsInput(val);
    const parsed = parseCoordinates(val);
    if (parsed) {
      setItinLatitude(parsed.lat);
      setItinLongitude(parsed.lng);
    } else {
      const parts = val.split(',');
      if (parts.length === 2) {
        const lat = parts[0].trim();
        const lng = parts[1].trim();
        if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
          setItinLatitude(lat);
          setItinLongitude(lng);
          return;
        }
      }
      if (!val.trim()) {
        setItinLatitude('');
        setItinLongitude('');
      }
    }
  };

  const handleEditLocationChange = (val: string) => {
    setEditItinLocation(val);
    const parsed = parseCoordinates(val);
    if (parsed) {
      setEditItinLatitude(parsed.lat);
      setEditItinLongitude(parsed.lng);
      setEditItinCoordsInput(val);
    }
  };

  const handleEditCoordsInputChange = (val: string) => {
    setEditItinCoordsInput(val);
    const parsed = parseCoordinates(val);
    if (parsed) {
      setEditItinLatitude(parsed.lat);
      setEditItinLongitude(parsed.lng);
    } else {
      const parts = val.split(',');
      if (parts.length === 2) {
        const lat = parts[0].trim();
        const lng = parts[1].trim();
        if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
          setEditItinLatitude(lat);
          setEditItinLongitude(lng);
          return;
        }
      }
      if (!val.trim()) {
        setEditItinLatitude('');
        setEditItinLongitude('');
      }
    }
  };

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
  const [checkPriority, setCheckPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [checkQuantity, setCheckQuantity] = useState<number>(1);
  const [checkAttachment, setCheckAttachment] = useState<File | null>(null);
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const [activeChecklistFilter, setActiveChecklistFilter] = useState<string>('All');
  const [checkPriorityFilter, setCheckPriorityFilter] = useState<string>('All');
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);

  const checkFileInputRef = useRef<HTMLInputElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Edit Checklist state
  const [editingChecklistItem, setEditingChecklistItem] = useState<ChecklistItem | null>(null);
  const [editCheckName, setEditCheckName] = useState('');
  const [editCheckCategory, setEditCheckCategory] = useState('Other');
  const [editCheckDescription, setEditCheckDescription] = useState('');
  const [editCheckPriority, setEditCheckPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [editCheckQuantity, setEditCheckQuantity] = useState<number>(1);
  const [editCheckAssignees, setEditCheckAssignees] = useState<string[]>(['Everyone']);
  const [showEditCheckAssigneeDropdown, setShowEditCheckAssigneeDropdown] = useState(false);

  const editCheckFileInputRef = useRef<HTMLInputElement>(null);
  const editCheckAssigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Close suggestions and dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
      if (itinGroupInputRef.current && !itinGroupInputRef.current.contains(event.target as Node)) {
        setShowItinGroupSuggestions(false);
      }
      if (editGroupInputRef.current && !editGroupInputRef.current.contains(event.target as Node)) {
        setShowEditGroupSuggestions(false);
      }
      if (editCheckAssigneeDropdownRef.current && !editCheckAssigneeDropdownRef.current.contains(event.target as Node)) {
        setShowEditCheckAssigneeDropdown(false);
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

  const filteredItinerary = useMemo(() => {
    let list = itinerary;
    if (itinFilterType !== 'All') {
      list = list.filter(item => item.type === itinFilterType);
    }
    if (itinSearchQuery.trim()) {
      const query = itinSearchQuery.toLowerCase();
      list = list.filter(item =>
        item.title.toLowerCase().includes(query) ||
        (item.location || '').toLowerCase().includes(query) ||
        (item.notes || '').toLowerCase().includes(query)
      );
    }
    return list;
  }, [itinerary, itinFilterType, itinSearchQuery]);

  const uniqueGroupTitles = useMemo(() => {
    const titles = new Set<string>();
    filteredItinerary.forEach((item) => {
      if (item.groupTitle) {
        titles.add(item.groupTitle);
      }
    });
    return Array.from(titles);
  }, [filteredItinerary]);

  const filteredGroupSuggestions = useMemo(() => {
    const query = itinGroupTitle.toLowerCase().trim();
    if (!query) return uniqueGroupTitles;
    return uniqueGroupTitles.filter(t => t.toLowerCase().includes(query));
  }, [itinGroupTitle, uniqueGroupTitles]);

  const groupedItinerary = useMemo<[string, ItineraryItem[]][]>(() => {
    const groups = new Map<string, ItineraryItem[]>();
    filteredItinerary.forEach((item) => {
      const groupName = item.groupTitle?.trim() || 'General Activities';
      groups.set(groupName, [...(groups.get(groupName) ?? []), item]);
    });
    return Array.from(groups.entries());
  }, [filteredItinerary]);

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
    // Parse cost: if it contains '-', store as costDisplay range string; also extract first number for numeric cost
    const costRaw = itinCost.trim();
    const costDisplay = costRaw || null;
    const costNum = costRaw ? parseFloat(costRaw.split('-')[0].trim()) : null;

    const formData = new FormData();
    formData.append('title', itinTitle.trim());
    formData.append('day', String(itinDay));
    formData.append('time', itinTime);
    if (itinTimeEnd.trim()) formData.append('timeEnd', itinTimeEnd.trim());
    formData.append('location', itinLocation.trim());
    if (costDisplay) formData.append('costDisplay', costDisplay);
    if (costNum !== null && !isNaN(costNum)) formData.append('cost', String(costNum));
    formData.append('type', itinType);
    formData.append('notes', itinNotes.trim());
    formData.append('groupTitle', groupTitle);
    formData.append('status', itinStatus);
    if (itinLatitude) formData.append('latitude', itinLatitude);
    if (itinLongitude) formData.append('longitude', itinLongitude);
    if (itinAttachment) {
      formData.append('file', itinAttachment);
    }

    const optimisticItem: ItineraryItem = {
      id: 'temp_' + Date.now(),
      day: itinDay,
      time: itinTime,
      timeEnd: itinTimeEnd.trim() || null,
      title: itinTitle.trim(),
      location: itinLocation.trim(),
      cost: costNum ?? undefined,
      costDisplay,
      type: itinType,
      notes: itinNotes.trim() || undefined,
      groupTitle,
      status: itinStatus,
      latitude: itinLatitude || null,
      longitude: itinLongitude || null,
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
    setItinTimeEnd('');
    setItinNotes('');
    setItinGroupTitle('');
    setItinStatus('Planned');
    setItinAttachment(null);
    setItinLatitude('');
    setItinLongitude('');
    setItinCoordsInput('');
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

  const openEditItinerary = (item: ItineraryItem) => {
    setEditingItinItem(item);
    setEditItinTitle(item.title);
    setEditItinDay(item.day);
    setEditItinTime(item.time);
    setEditItinTimeEnd(item.timeEnd || '');
    setEditItinLocation(item.location || '');
    setEditItinCost(item.costDisplay || (item.cost != null ? String(item.cost) : ''));
    setEditItinType(item.type);
    setEditItinNotes(item.notes || '');
    setEditItinGroupTitle(item.groupTitle || '');
    setEditItinStatus(item.status || 'Planned');
    setEditItinLatitude(item.latitude || '');
    setEditItinLongitude(item.longitude || '');
    setEditItinCoordsInput(item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : '');
    setEditItinAttachment(null);
    if (editItinFileInputRef.current) editItinFileInputRef.current.value = '';
  };

  const handleEditItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItinItem || !editItinTitle.trim()) return;
    setIsSavingItinEdit(true);

    const groupTitle = editItinGroupTitle.trim() || 'General Activities';
    const costRaw = editItinCost.trim();
    const costDisplay = costRaw || null;
    const costNum = costRaw ? parseFloat(costRaw.split('-')[0].trim()) : null;

    const formData = new FormData();
    formData.append('title', editItinTitle.trim());
    formData.append('day', String(editItinDay));
    formData.append('time', editItinTime);
    formData.append('timeEnd', editItinTimeEnd.trim()); // empty string → clears end time
    formData.append('location', editItinLocation.trim());
    formData.append('costDisplay', costDisplay ?? '');
    if (costNum !== null && !isNaN(costNum)) formData.append('cost', String(costNum));
    formData.append('type', editItinType);
    formData.append('notes', editItinNotes.trim());
    formData.append('groupTitle', groupTitle);
    formData.append('status', editItinStatus);
    formData.append('latitude', editItinLatitude);
    formData.append('longitude', editItinLongitude);
    if (editItinAttachment) formData.append('file', editItinAttachment);

    // Optimistic update
    const previous = itinerary;
    const optimistic = itinerary.map(item =>
      item.id === editingItinItem.id
        ? {
            ...item,
            title: editItinTitle.trim(),
            day: editItinDay,
            time: editItinTime,
            timeEnd: editItinTimeEnd.trim() || null,
            location: editItinLocation.trim(),
            cost: costNum ?? item.cost,
            costDisplay,
            type: editItinType,
            notes: editItinNotes.trim(),
            groupTitle,
            status: editItinStatus,
            latitude: editItinLatitude || null,
            longitude: editItinLongitude || null,
          }
        : item
    ).sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.time.localeCompare(b.time);
    });
    mutateItinerary({ success: true, itinerary: optimistic }, { revalidate: false });
    setEditingItinItem(null);
    haptics.success();

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/itinerary?id=${editingItinItem.id}`, {
        method: 'PATCH',
        body: formData,
      });
      if (!res.ok) throw new Error();
      mutateItinerary();
    } catch {
      mutateItinerary({ success: true, itinerary: previous }, { revalidate: true });
    } finally {
      setIsSavingItinEdit(false);
    }
  };

  const handleCycleStatus = async (item: ItineraryItem) => {
    const statusOrder: ('Planned' | 'Booked' | 'Completed')[] = ['Planned', 'Booked', 'Completed'];
    const currentIndex = statusOrder.indexOf(item.status || 'Planned');
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    
    const previous = itinerary;
    const updated = itinerary.map(i => i.id === item.id ? { ...i, status: nextStatus } : i);
    mutateItinerary({ success: true, itinerary: updated }, { revalidate: false });
    haptics.tap();

    const formData = new FormData();
    formData.append('title', item.title);
    formData.append('day', String(item.day));
    formData.append('time', item.time);
    formData.append('timeEnd', item.timeEnd || '');
    formData.append('location', item.location || '');
    formData.append('costDisplay', item.costDisplay || '');
    if (item.cost !== undefined && item.cost !== null) formData.append('cost', String(item.cost));
    formData.append('type', item.type);
    formData.append('notes', item.notes || '');
    formData.append('groupTitle', item.groupTitle || 'General Activities');
    formData.append('status', nextStatus);

    try {
      const res = await fetch(`/api/bill-splits/tours/${tourId}/itinerary?id=${item.id}`, {
        method: 'PATCH',
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

  const handleToggleEditCheckAssignee = (name: string) => {
    if (name === 'Everyone') {
      setEditCheckAssignees(['Everyone']);
    } else {
      let updated = editCheckAssignees.filter(a => a !== 'Everyone');
      if (updated.includes(name)) {
        updated = updated.filter(a => a !== name);
      } else {
        updated.push(name);
      }
      if (updated.length === 0) {
        updated = ['Everyone'];
      }
      setEditCheckAssignees(updated);
    }
  };

  const openEditChecklist = (item: ChecklistItem) => {
    setEditingChecklistItem(item);
    setEditCheckName(item.name);
    setEditCheckCategory(item.category);
    setEditCheckDescription(item.description || '');
    setEditCheckPriority(item.priority || 'Medium');
    setEditCheckQuantity(item.quantity || 1);
    
    const assignees = item.assignedTo ? item.assignedTo.split(',').map(s => s.trim()).filter(Boolean) : ['Everyone'];
    setEditCheckAssignees(assignees.length > 0 ? assignees : ['Everyone']);
    setShowEditCheckAssigneeDropdown(false);
  };

  const handleEditChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChecklistItem || !editCheckName.trim()) return;

    const previous = checklist;
    const assignedToString = editCheckAssignees.includes('Everyone') ? 'Everyone' : editCheckAssignees.join(', ');

    // Recalculate if it should be completed based on the new assignee list and existing completedBy list
    const completedByArr = getCompletedByArray(editingChecklistItem.completedBy);
    const requiredCheckmarkers = (() => {
      if (assignedToString === 'Everyone') {
        return participants.map(p => p.name);
      }
      return assignedToString.split(',').map(s => s.trim()).filter(Boolean);
    })();
    const isFullyCompleted = requiredCheckmarkers.length > 0 && 
      requiredCheckmarkers.every(name => completedByArr.includes(name));

    const updatedItem: ChecklistItem = {
      ...editingChecklistItem,
      name: editCheckName.trim(),
      category: editCheckCategory,
      description: editCheckDescription.trim(),
      priority: editCheckPriority,
      quantity: editCheckQuantity,
      assignedTo: assignedToString,
      completed: isFullyCompleted,
    };

    const updated = checklist.map(i => i.id === editingChecklistItem.id ? updatedItem : i);
    mutateChecklist({ success: true, checklist: updated, categories: customCategoriesList }, { revalidate: false });
    setEditingChecklistItem(null);
    haptics.success();

    const formData = new FormData();
    formData.append('id', String(editingChecklistItem.id));
    formData.append('name', editCheckName.trim());
    formData.append('category', editCheckCategory);
    formData.append('assignedTo', assignedToString);
    formData.append('description', editCheckDescription.trim());
    formData.append('priority', editCheckPriority);
    formData.append('quantity', String(editCheckQuantity));
    formData.append('completed', String(isFullyCompleted));
    formData.append('completedBy', editingChecklistItem.completedBy || '[]');

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

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkName.trim()) return;

    const priorityVal = checkPriority;
    const quantityVal = checkQuantity;

    const formData = new FormData();
    formData.append('name', checkName.trim());
    formData.append('category', checkCategory);
    formData.append('assignedTo', selectedAssignees.join(', '));
    formData.append('description', checkDescription.trim());
    formData.append('priority', priorityVal);
    formData.append('quantity', String(quantityVal));
    if (checkAttachment) {
      formData.append('file', checkAttachment);
    }

    const optimisticItem: ChecklistItem = {
      id: 'temp_' + Date.now(),
      name: checkName.trim(),
      category: checkCategory,
      assignedTo: selectedAssignees.join(', '),
      completed: false,
      description: checkDescription.trim() || undefined,
      priority: priorityVal,
      quantity: quantityVal,
      attachmentName: checkAttachment ? checkAttachment.name : undefined,
    };

    const previous = checklist;
    mutateChecklist({ success: true, checklist: [...checklist, optimisticItem], categories: customCategoriesList }, { revalidate: false });

    // Reset fields
    setCheckName('');
    setCheckCategory('Other');
    setSelectedAssignees(['Everyone']);
    setCheckDescription('');
    setCheckPriority('Medium');
    setCheckQuantity(1);
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

  const handleImportPreset = async (type: keyof typeof packingPresets) => {
    const presetItems = packingPresets[type];
    haptics.success();
    
    const previous = checklist;
    const tempItems: ChecklistItem[] = presetItems.map((item, idx) => ({
      id: 'temp_preset_' + Date.now() + '_' + idx,
      name: item.name,
      category: item.category,
      assignedTo: 'Everyone',
      completed: false,
      priority: item.priority as any,
      quantity: item.quantity,
    }));
    mutateChecklist({ success: true, checklist: [...checklist, ...tempItems], categories: customCategoriesList }, { revalidate: false });

    try {
      for (const item of presetItems) {
        const formData = new FormData();
        formData.append('name', item.name);
        formData.append('category', item.category);
        formData.append('assignedTo', 'Everyone');
        formData.append('priority', item.priority);
        formData.append('quantity', String(item.quantity));
        await fetch(`/api/bill-splits/tours/${tourId}/checklist`, {
          method: 'POST',
          body: formData,
        });
      }
      mutateChecklist();
    } catch {
      mutateChecklist({ success: true, checklist: previous, categories: customCategoriesList }, { revalidate: true });
    }
  };

  const handleToggleChecklist = async (id: string) => {
    const item = checklist.find(i => i.id === id);
    if (!item) return;

    const completedByArr = getCompletedByArray(item.completedBy);
    let newCompletedByArr = [...completedByArr];
    
    if (completedByArr.includes(currentUserName)) {
      newCompletedByArr = newCompletedByArr.filter(name => name !== currentUserName);
    } else {
      newCompletedByArr.push(currentUserName);
    }

    const requiredCheckmarkers = (() => {
      if (!item.assignedTo || item.assignedTo === 'Everyone') {
        return participants.map(p => p.name);
      }
      return item.assignedTo.split(',').map(s => s.trim()).filter(Boolean);
    })();

    const isFullyCompleted = requiredCheckmarkers.length > 0 && 
      requiredCheckmarkers.every(name => newCompletedByArr.includes(name));

    const newCompletedByStr = JSON.stringify(newCompletedByArr);
    const newCompleted = isFullyCompleted;

    const previous = checklist;
    const updated = checklist.map(i => i.id === id ? { ...i, completed: newCompleted, completedBy: newCompletedByStr } : i);
    mutateChecklist({ success: true, checklist: updated, categories: customCategoriesList }, { revalidate: false });
    haptics.tap();

    const formData = new FormData();
    formData.append('id', String(id));
    formData.append('completed', String(newCompleted));
    formData.append('completedBy', newCompletedByStr);

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
      { name: 'Passports & Visas', category: 'Documents', assignedTo: 'Everyone', priority: 'High', quantity: 1 },
      { name: 'Flight & Hotel Bookings', category: 'Documents', assignedTo: 'Everyone', priority: 'High', quantity: 1 },
      { name: 'Local Currency / Cards', category: 'Documents', assignedTo: 'Everyone', priority: 'High', quantity: 1 },
      { name: 'Phone Chargers & Power Banks', category: 'Electronics', assignedTo: 'Everyone', priority: 'Medium', quantity: 1 },
      { name: 'Universal Travel Adapter', category: 'Electronics', assignedTo: 'Everyone', priority: 'Medium', quantity: 1 },
      { name: 'Toothbrush & Travel Toiletries', category: 'Toiletries', assignedTo: 'Everyone', priority: 'Medium', quantity: 1 },
      { name: 'First-aid & Daily Medicines', category: 'Other', assignedTo: 'Everyone', priority: 'High', quantity: 1 },
      { name: 'Weather-appropriate Clothes', category: 'Clothing', assignedTo: 'Everyone', priority: 'High', quantity: 5 },
    ];

    const previous = checklist;
    try {
      for (const item of defaults) {
        const formData = new FormData();
        formData.append('name', item.name);
        formData.append('category', item.category);
        formData.append('assignedTo', item.assignedTo);
        formData.append('priority', item.priority);
        formData.append('quantity', String(item.quantity));
        await fetch(`/api/bill-splits/tours/${tourId}/checklist`, {
          method: 'POST',
          body: formData,
        });
      }
      mutateChecklist();
      haptics.success();
    } catch {
      mutateChecklist({ success: true, checklist: previous, categories: customCategoriesList }, { revalidate: true });
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
        <div className="mb-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <Link href="/tours" className="mb-3 inline-flex items-center gap-2 rounded-2xl text-xs font-black uppercase tracking-[0.18em] text-gray-500 transition-colors hover:text-gray-950 dark:hover:text-white">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Tours
            </Link>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-primary sm:text-xs">Tour Dashboard</p>
            <h1 className="max-w-4xl text-balance text-[2rem] font-black tracking-tight text-gray-950 dark:text-white sm:text-4xl lg:text-5xl">
              {tour.name}
            </h1>
            {dashboardData && (
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-3 text-[11px] font-medium text-gray-500 dark:border-white/5 dark:text-gray-400 sm:text-xs">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Balance: <span className="font-bold text-gray-950 dark:text-white">{fmt(dashboardData.balance)}</span>
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Earnings: <span className="font-bold text-gray-950 dark:text-white">{fmt(dashboardData.earnings.current)}</span>
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Expenses: <span className="font-bold text-gray-950 dark:text-white">{fmt(dashboardData.expenses.current)}</span>
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Net Savings: <span className="font-bold text-gray-950 dark:text-white">{fmt(dashboardData.netSavings)}</span>
                </span>
              </div>
            )}
          </motion.div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            {tour.createdBy === currentUserId && (
              <motion.button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/50 px-4 py-3 text-xs font-black text-gray-700 backdrop-blur-xl hover:bg-gray-50 sm:w-auto sm:px-5 sm:py-3.5 sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/10"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs font-black text-primary backdrop-blur-xl hover:bg-primary/15 sm:w-auto sm:px-5 sm:py-3.5 sm:text-sm dark:border-primary/30"
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
              className="inline-flex col-span-2 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-black text-white shadow-[0_18px_38px_rgba(19,109,236,0.22)] hover:bg-primary-hover sm:col-span-1 sm:w-auto sm:px-5 sm:py-3.5 sm:text-sm"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
              Add Cost
            </motion.button>
          </div>
        </div>

        <div className="-mx-4 mb-8 flex snap-x snap-mandatory flex-nowrap gap-3 overflow-x-auto px-4 pb-2 overscroll-x-contain sm:mx-0 sm:px-0 md:gap-4 md:overflow-visible lg:gap-5 stagger-children">
          <TiltCard className="glass-panel stat-gradient-blue min-w-[9.75rem] flex-[0_0_9.75rem] snap-start rounded-3xl relative overflow-hidden group breathe p-4 md:min-w-0 md:flex-1 lg:p-6" style={{ animationDelay: '0s', animation: 'slideUp 0.5s ease-out 0s both' }}>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="whitespace-nowrap text-gray-500 dark:text-text-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">Total Spent</p>
                <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight number-appear">{fmt(totalSpent)}</h3>
            </div>
          </TiltCard>
          <TiltCard className="glass-panel stat-gradient-emerald min-w-[9.75rem] flex-[0_0_9.75rem] snap-start rounded-3xl relative overflow-hidden group breathe p-4 md:min-w-0 md:flex-1 lg:p-6" style={{ animationDelay: '0.08s', animation: 'slideUp 0.5s ease-out 0.08s both' }}>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="whitespace-nowrap text-gray-500 dark:text-text-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">Per Person</p>
                <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight number-appear">{fmt(perPerson)}</h3>
            </div>
          </TiltCard>
          <TiltCard className="glass-panel stat-gradient-orange min-w-[9.75rem] flex-[0_0_9.75rem] snap-start rounded-3xl relative overflow-hidden group breathe p-4 md:min-w-0 md:flex-1 lg:p-6" style={{ animationDelay: '0.16s', animation: 'slideUp 0.5s ease-out 0.16s both' }}>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="whitespace-nowrap text-gray-500 dark:text-text-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">Avg Cost</p>
                <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight number-appear">{fmt(averageCost)}</h3>
            </div>
          </TiltCard>
          <TiltCard className={`glass-panel ${myBalance >= 0 ? 'stat-gradient-blue' : 'stat-gradient-rose'} min-w-[9.75rem] flex-[0_0_9.75rem] snap-start rounded-3xl relative overflow-hidden group breathe p-4 md:min-w-0 md:flex-1 lg:p-6`} style={{ animationDelay: '0.24s', animation: 'slideUp 0.5s ease-out 0.24s both' }}>
            <div className="flex flex-col gap-1 relative z-10">
                <p className="whitespace-nowrap text-gray-500 dark:text-text-muted text-[10px] font-semibold uppercase tracking-wider sm:text-xs">My Balance</p>
                <h3 className="truncate whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight number-appear">
                  {myBalance > 0 ? '+' : myBalance < 0 ? '-' : ''}{fmt(Math.abs(myBalance))}
                </h3>
            </div>
          </TiltCard>
        </div>

        {/* Navigation Tabs */}
        <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto border-b border-gray-200 px-4 pb-4 dark:border-white/10 sm:mx-0 sm:px-0">
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
                className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black transition-all outline-none sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm ${
                  isActive ? 'text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute inset-0 rounded-full bg-primary shadow-lg shadow-primary/20 sm:rounded-2xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 whitespace-nowrap">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">{tab.icon}</span>
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
              {/* Mobile Sub-tab Switcher */}
              <div className="lg:hidden flex p-1 bg-gray-100 dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 mb-6">
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setLedgerSubTab('transactions'); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black rounded-xl transition-all ${
                    ledgerSubTab === 'transactions'
                      ? 'bg-white dark:bg-slate-900 text-primary shadow-sm border border-gray-200/50 dark:border-white/5'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  Ledger
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setLedgerSubTab('balances'); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black rounded-xl transition-all ${
                    ledgerSubTab === 'balances'
                      ? 'bg-white dark:bg-slate-900 text-primary shadow-sm border border-gray-200/50 dark:border-white/5'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                  Balances
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setLedgerSubTab('analytics'); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black rounded-xl transition-all ${
                    ledgerSubTab === 'analytics'
                      ? 'bg-white dark:bg-slate-900 text-primary shadow-sm border border-gray-200/50 dark:border-white/5'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">analytics</span>
                  Analytics
                </button>
              </div>

              {/* Split-Screen Analytics: Spending Trends & Expense Distribution */}
              <div className={`flex flex-col lg:flex-row gap-5 ${ledgerSubTab !== 'analytics' ? 'hidden lg:flex' : ''}`}>
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
              <div className={`mt-8 ${ledgerSubTab !== 'balances' ? 'hidden lg:block' : ''}`}>
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
              <div className={`mt-10 ${ledgerSubTab !== 'transactions' ? 'hidden lg:block' : ''}`}>
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
              {/* Itinerary Overview HUD & Control Bar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 glass-panel p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
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

                  {/* Search and Quick Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                      <input
                        type="text"
                        placeholder="Search activities, notes, locations..."
                        value={itinSearchQuery}
                        onChange={(e) => setItinSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] pl-9 pr-4 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-primary"
                      />
                    </div>
                    <select
                      value={itinFilterType}
                      onChange={(e) => setItinFilterType(e.target.value)}
                      className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-[#111827] px-3 py-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:border-primary"
                    >
                      <option value="All">All Types 🌐</option>
                      <option value="activity">Activities 🎯</option>
                      <option value="flight">Flights ✈️</option>
                      <option value="hotel">Hotels 🏨</option>
                      <option value="food">Food 🍽️</option>
                      <option value="transport">Transport 🚗</option>
                      <option value="other">Other 📦</option>
                    </select>
                  </div>
                </div>

                {/* Estimate Cost HUD Card */}
                <div className="glass-panel p-6 rounded-3xl relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-emerald-500">monetization_on</span>
                      Itinerary Budget HUD
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold">Allocated estimated budget vs actual spendings</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-gray-400">Est. Total:</span>
                      <span className="text-gray-900 dark:text-white">{fmt(estimatedTotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-gray-400">Actual Spent:</span>
                      <span className="text-rose-500">{fmt(totalSpent)}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, estimatedTotal > 0 ? (totalSpent / estimatedTotal) * 100 : 0)}%` }}
                        className={`h-full rounded-full ${totalSpent > estimatedTotal ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Activity Form */}
              <AnimatePresence>
                {isAddingItinerary && (
                  <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                    <motion.form
                      onSubmit={handleAddItinerary}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
                        <div ref={itinGroupInputRef} className="relative sm:col-span-2">
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
                        <div className="sm:col-span-2">
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
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Day #</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={itinDay}
                            onChange={e => setItinDay(Number(e.target.value))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Start Time <span className="text-primary">*</span></label>
                          <input
                            type="time"
                            required
                            value={itinTime}
                            onChange={e => setItinTime(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary [color-scheme:dark]"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">End Time <span className="text-gray-500 font-normal">(optional)</span></label>
                          <input
                            type="time"
                            value={itinTimeEnd}
                            onChange={e => setItinTimeEnd(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary [color-scheme:dark]"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Cost (Optional)</label>
                          <input
                            type="text"
                            value={itinCost}
                            onChange={e => setItinCost(e.target.value)}
                            placeholder="e.g. 500 or 250-400"
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
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Status</label>
                          <select
                            value={itinStatus}
                            onChange={e => setItinStatus(e.target.value as any)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          >
                            <option value="Planned">Planned 🗓️</option>
                            <option value="Booked">Booked ✅</option>
                            <option value="Completed">Completed 🎉</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Location</label>
                          <input
                            type="text"
                            value={itinLocation}
                            onChange={e => handleLocationChange(e.target.value)}
                            placeholder="e.g. Paris, France"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Google Maps URL / Coords</label>
                          <input
                            type="text"
                            value={itinCoordsInput}
                            onChange={e => handleCoordsInputChange(e.target.value)}
                            placeholder="Paste maps link or lat,lng"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Notes</label>
                          <textarea
                            value={itinNotes}
                            onChange={e => setItinNotes(e.target.value)}
                            placeholder="Confirmation codes, reminders, reservation links..."
                            className="mt-1 min-h-[46px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
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
                  </div>
                )}
              </AnimatePresence>

              {filteredItinerary.length === 0 ? (
                <div className="glass-panel flex min-h-72 flex-col items-center justify-center rounded-3xl p-8 text-center">
                  <span className="material-symbols-outlined mb-4 text-6xl text-gray-300 dark:text-gray-600">route</span>
                  <h3 className="text-xl font-black text-gray-950 dark:text-white">No activities found</h3>
                  <p className="mt-2 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">
                    {itinerary.length > 0 ? 'Try clearing your search or category filters.' : 'Start planning your trip schedule by adding flight timings, hotel stays, and exciting activities!'}
                  </p>
                  {itinerary.length === 0 && (
                    <button
                      type="button"
                      onClick={() => { haptics.tap(); setIsAddingItinerary(true); }}
                      className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
                    >
                      <span className="material-symbols-outlined text-[20px]">add</span>
                      Add First Activity
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-10 relative">
                  {/* Dynamic Timeline Vertical Connecting Line */}
                  <div className="absolute left-[37px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary via-emerald-500/50 to-orange-500/20 dark:from-primary/50 dark:via-emerald-500/30 dark:to-transparent hidden sm:block" />

                  {groupedItinerary.map(([groupName, items]) => {
                    const isExpanded = expandedGroups[groupName] ?? false;
                    const visibleItems = isExpanded ? items : items.slice(0, 5);
                    const showExpand = items.length > 5;

                    return (
                      <div key={groupName} className="space-y-4 relative z-10">
                        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-white/10 pb-2">
                          <span className="material-symbols-outlined text-[20px] text-primary">folder_open</span>
                          <h3 className="text-lg font-black text-gray-950 dark:text-white">{groupName}</h3>
                          <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-xs font-black text-gray-500 dark:text-gray-400">
                            {items.length} {items.length === 1 ? 'activity' : 'activities'}
                          </span>
                        </div>

                        <div className="relative ml-0 sm:ml-9 space-y-6 py-2">
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
                            
                            const statusMeta = {
                              Planned: { bg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20', label: 'Planned' },
                              Booked: { bg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20', label: 'Booked' },
                              Completed: { bg: 'bg-blue-500/10 text-blue-500 border border-blue-500/20', label: 'Completed' }
                            };
                            const currentStatus = item.status || 'Planned';
                            const meta = statusMeta[currentStatus];
                                    const prevItem = index > 0 ? visibleItems[index - 1] : null;
                            const hasDistance = prevItem && hasCoords(prevItem) && hasCoords(item);
                            const distance = hasDistance
                              ? haversineDistance(
                                  parseFloat(prevItem.latitude!),
                                  parseFloat(prevItem.longitude!),
                                  parseFloat(item.latitude!),
                                  parseFloat(item.longitude!)
                                )
                              : null;

                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="relative group pl-0 sm:pl-10"
                              >
                                {/* Distance segment connection on timeline (Desktop only) */}
                                {distance !== null && (
                                  <div className="absolute left-[16px] sm:left-[0px] top-[-26px] h-7 w-0.5 bg-emerald-500/70 hidden sm:flex items-center justify-center z-10">
                                    <div className="absolute -translate-x-1/2 left-1/2 bg-emerald-500 text-white dark:bg-emerald-600 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md whitespace-nowrap border border-white/10 flex items-center gap-1 hover:scale-105 transition-transform">
                                      <span className="material-symbols-outlined text-[9px] font-black">navigation</span>
                                      {formatDistance(distance)}
                                    </div>
                                  </div>
                                )}

                                {/* Glow timeline node */}
                                <div 
                                  onClick={() => handleCycleStatus(item)}
                                  title="Click to cycle status"
                                  className="absolute left-[-2px] sm:left-[-18px] top-1.5 flex size-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-gray-300 transition-all hover:scale-110 cursor-pointer z-20 group-hover:border-primary/40 group-hover:shadow-[0_0_12px_rgba(19,109,236,0.3)]"
                                >
                                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                </div>

                                <div className="glass-panel p-5 rounded-2xl relative overflow-hidden transition-all hover:translate-x-1 duration-200">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">
                                        Day {item.day}
                                      </span>
                                      {/* Time Range - AM/PM views */}
                                      <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                                        {formatTime12h(item.time)}{item.timeEnd ? ` – ${formatTime12h(item.timeEnd)}` : ''}
                                      </span>
                                      {/* Quick Click-to-Cycle Status Badge */}
                                      <button
                                        type="button"
                                        onClick={() => handleCycleStatus(item)}
                                        className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition-all hover:scale-105 cursor-pointer ${meta.bg}`}
                                      >
                                        {meta.label}
                                      </button>
                                      <h4 className="text-base font-black text-gray-950 dark:text-white ml-1">{item.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                      {(item.costDisplay || item.cost) && (
                                        <span className="text-sm font-mono font-black text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-lg">
                                          Est. {item.costDisplay
                                            ? item.costDisplay.includes('-')
                                              ? item.costDisplay.replace('-', ' – ')
                                              : item.costDisplay
                                            : fmt(Number(item.cost))}
                                        </span>
                                      )}
                                      {/* Edit button */}
                                      <button
                                        type="button"
                                        onClick={() => openEditItinerary(item)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-primary/10 hover:text-primary transition-colors"
                                        title="Edit activity"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                      </button>
                                      {/* Delete button */}
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
                                    <div className="mt-2 space-y-1.5 pl-0 sm:pl-1">
                                      {item.location && (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <a
                                            href={item.latitude && item.longitude ? `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span className="material-symbols-outlined text-[15px] text-primary">pin_drop</span>
                                            {item.location}
                                          </a>
                                          {item.latitude && item.longitude && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                                              <span className="material-symbols-outlined text-[9px]">location_on</span>
                                              GPS Coords
                                            </span>
                                          )}
                                          {distance !== null && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 sm:hidden">
                                              <span className="material-symbols-outlined text-[9px]">navigation</span>
                                              {formatDistance(distance)} from prev
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {item.notes && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 bg-white/[0.01] border border-gray-100 dark:border-white/[0.04] p-2.5 rounded-lg leading-relaxed italic">
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

              {/* ── Edit Itinerary Activity Modal ── */}
              <AnimatePresence>
                {editingItinItem && (
                  <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-0 sm:px-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setEditingItinItem(null)}
                      className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg"
                    />
                    <motion.form
                      onSubmit={handleEditItinerary}
                      initial={{ opacity: 0, y: 40, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 30, scale: 0.97 }}
                      transition={spring}
                      className="relative z-10 w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0A0E1A]/98 shadow-2xl backdrop-blur-xl p-6 sm:p-8 space-y-5"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Edit Activity</p>
                          <h2 className="mt-1 text-xl font-black text-white">Update Itinerary Item</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingItinItem(null)}
                          className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
                        >
                          <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                      </div>

                      {/* Group + Title + Day */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
                        <div ref={editGroupInputRef} className="relative sm:col-span-2">
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Group Category</label>
                          <input
                            type="text"
                            value={editItinGroupTitle}
                            onFocus={() => setShowEditGroupSuggestions(true)}
                            onChange={e => { setEditItinGroupTitle(e.target.value); setShowEditGroupSuggestions(true); }}
                            placeholder="e.g. Day 1"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                          {showEditGroupSuggestions && uniqueGroupTitles.filter(t => !editItinGroupTitle || t.toLowerCase().includes(editItinGroupTitle.toLowerCase())).length > 0 && (
                            <div className="absolute left-0 right-0 z-20 mt-1 max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-2 shadow-lg">
                              {uniqueGroupTitles.filter(t => !editItinGroupTitle || t.toLowerCase().includes(editItinGroupTitle.toLowerCase())).map(s => (
                                <button key={s} type="button"
                                  onClick={() => { setEditItinGroupTitle(s); setShowEditGroupSuggestions(false); }}
                                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-gray-300 hover:bg-white/5"
                                >{s}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Activity Title</label>
                          <input
                            type="text"
                            required
                            value={editItinTitle}
                            onChange={e => setEditItinTitle(e.target.value)}
                            placeholder="e.g. Eiffel Tower Visit"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Day #</label>
                          <input
                            type="number" required min="1"
                            value={editItinDay}
                            onChange={e => setEditItinDay(Number(e.target.value))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Time Range + Cost + Type */}
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Start Time <span className="text-primary">*</span></label>
                          <input
                            type="time" required
                            value={editItinTime}
                            onChange={e => setEditItinTime(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary [color-scheme:dark]"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">End Time <span className="text-gray-500 font-normal">(opt)</span></label>
                          <input
                            type="time"
                            value={editItinTimeEnd}
                            onChange={e => setEditItinTimeEnd(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary [color-scheme:dark]"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Cost (Optional)</label>
                          <input
                            type="text"
                            value={editItinCost}
                            onChange={e => setEditItinCost(e.target.value)}
                            placeholder="e.g. 500 or 250-400"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Type</label>
                          <select
                            value={editItinType}
                            onChange={e => setEditItinType(e.target.value as any)}
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
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Status</label>
                          <select
                            value={editItinStatus}
                            onChange={e => setEditItinStatus(e.target.value as any)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          >
                            <option value="Planned">Planned 🗓️</option>
                            <option value="Booked">Booked ✅</option>
                            <option value="Completed">Completed 🎉</option>
                          </select>
                        </div>
                      </div>

                      {/* Location + Notes + File */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Location</label>
                          <input
                            type="text"
                            value={editItinLocation}
                            onChange={e => handleEditLocationChange(e.target.value)}
                            placeholder="e.g. Paris, France"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Google Maps URL / Coords</label>
                          <input
                            type="text"
                            value={editItinCoordsInput}
                            onChange={e => handleEditCoordsInputChange(e.target.value)}
                            placeholder="Paste maps link or lat,lng"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Notes</label>
                          <textarea
                            value={editItinNotes}
                            onChange={e => setEditItinNotes(e.target.value)}
                            placeholder="Confirmation codes, links..."
                            className="mt-1 min-h-[46px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Replace File (Optional)</label>
                          <input
                            ref={editItinFileInputRef}
                            type="file"
                            onChange={e => setEditItinAttachment(e.target.files?.[0] || null)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-white outline-none"
                          />
                          {editingItinItem?.attachmentName && !editItinAttachment && (
                            <p className="mt-1 ml-1 text-[10px] text-gray-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">attachment</span>
                              {editingItinItem.attachmentName}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingItinItem(null)}
                          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-black text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingItinEdit}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-white shadow-md hover:bg-primary-hover disabled:opacity-60"
                        >
                          {isSavingItinEdit ? (
                            <span className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-[18px]">save</span>
                          )}
                          {isSavingItinEdit ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </motion.form>
                  </div>
                )}
              </AnimatePresence>

              {/* ── Edit Checklist Item Modal ── */}
              <AnimatePresence>
                {editingChecklistItem && (
                  <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-0 sm:px-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setEditingChecklistItem(null)}
                      className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg"
                    />
                    <motion.form
                      onSubmit={handleEditChecklist}
                      initial={{ opacity: 0, y: 40, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 30, scale: 0.97 }}
                      transition={spring}
                      className="relative z-10 w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 bg-[#0A0E1A]/98 shadow-2xl backdrop-blur-xl p-6 sm:p-8 space-y-5 text-left"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Edit Item</p>
                          <h2 className="mt-1 text-xl font-black text-white">Update Checklist Item</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingChecklistItem(null)}
                          className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white"
                        >
                          <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Item Name</label>
                          <input
                            type="text"
                            required
                            value={editCheckName}
                            onChange={e => setEditCheckName(e.target.value)}
                            placeholder="e.g. Passport, Sunglasses"
                            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Category</label>
                          <select
                            value={editCheckCategory}
                            onChange={e => setEditCheckCategory(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
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
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div ref={editCheckAssigneeDropdownRef} className="relative">
                          <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Assigned To</label>
                          <button
                            type="button"
                            onClick={() => setShowEditCheckAssigneeDropdown(!showEditCheckAssigneeDropdown)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm font-bold text-white text-left outline-none focus:border-primary flex justify-between items-center"
                          >
                            <span className="truncate">{editCheckAssignees.join(', ')}</span>
                            <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                          </button>
                          {showEditCheckAssigneeDropdown && (
                            <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#0F172A] p-2.5 shadow-lg space-y-1">
                              <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editCheckAssignees.includes('Everyone')}
                                  onChange={() => handleToggleEditCheckAssignee('Everyone')}
                                  className="rounded border-white/20 bg-transparent text-primary focus:ring-primary"
                                />
                                <span className="text-xs font-bold text-gray-300">Everyone</span>
                              </label>
                              {participants.map(p => (
                                <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editCheckAssignees.includes(p.name)}
                                    onChange={() => handleToggleEditCheckAssignee(p.name)}
                                    className="rounded border-white/20 bg-transparent text-primary focus:ring-primary"
                                  />
                                  <span className="text-xs font-bold text-gray-300">{p.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Priority</label>
                            <select
                              value={editCheckPriority}
                              onChange={e => setEditCheckPriority(e.target.value as any)}
                              className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                            >
                              <option value="High">High 🔴</option>
                              <option value="Medium">Medium 🟡</option>
                              <option value="Low">Low 🟢</option>
                            </select>
                          </div>
                          <div>
                            <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={editCheckQuantity}
                              onChange={e => setEditCheckQuantity(parseInt(e.target.value, 10) || 1)}
                              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Description (Optional)</label>
                        <textarea
                          value={editCheckDescription}
                          onChange={e => setEditCheckDescription(e.target.value)}
                          placeholder="e.g. Brand, color, size, pack location..."
                          className="mt-1 min-h-[60px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"
                        />
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingChecklistItem(null)}
                          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-black text-white hover:bg-white/[0.08]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 rounded-xl bg-primary py-3 text-sm font-black text-white shadow-md hover:bg-primary-hover"
                        >
                          Save Changes
                        </button>
                      </div>
                    </motion.form>
                  </div>
                )}
              </AnimatePresence>

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
                            <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Priority</label>
                            <select
                              value={checkPriority}
                              onChange={e => setCheckPriority(e.target.value as any)}
                              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111827] px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary"
                            >
                              <option value="High">🔴 High Priority</option>
                              <option value="Medium">🟡 Medium Priority</option>
                              <option value="Low">🟢 Low Priority</option>
                            </select>
                          </div>
                          <div>
                            <label className="ml-1 text-xs font-black uppercase tracking-[0.16em] text-gray-500">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={checkQuantity}
                              onChange={e => setCheckQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-primary"
                            />
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
                  <div className="space-y-4">
                    {/* Preset Templates Row */}
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-50 p-3.5 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04]">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-400 mr-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">auto_awesome</span>
                        Import Preset:
                      </span>
                      {(['beach', 'winter', 'adventure', 'business', 'casual'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleImportPreset(type)}
                          className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all capitalize shadow-sm"
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Category Tabs */}
                      <div className="flex flex-wrap gap-2">
                        {categoriesList.map(filter => {
                          const itemsInCategory = filter === 'All' ? checklist : checklist.filter(c => c.category === filter);
                          const total = itemsInCategory.length;
                          const completed = itemsInCategory.filter(c => c.completed).length;
                          const pct = total > 0 ? (completed / total) * 100 : 0;
                          const radius = 6;
                          const circumference = 2 * Math.PI * radius;
                          const strokeDashoffset = circumference - (pct / 100) * circumference;

                          return (
                            <button
                              key={filter}
                              onClick={() => setActiveChecklistFilter(filter)}
                              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeChecklistFilter === filter
                                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                                  : 'text-gray-500 border border-transparent hover:bg-gray-100 dark:hover:bg-white/5 dark:text-gray-400'
                              }`}
                            >
                              {total > 0 && (
                                <svg className="h-4 w-4 rotate-[-90deg] shrink-0">
                                  <circle
                                    className="text-gray-200 dark:text-white/10"
                                    strokeWidth="2"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r={radius}
                                    cx="8"
                                    cy="8"
                                  />
                                  <circle
                                    className={pct === 100 ? "text-emerald-500" : "text-primary"}
                                    strokeWidth="2"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r={radius}
                                    cx="8"
                                    cy="8"
                                  />
                                </svg>
                              )}
                              <span>{filter}</span>
                              {total > 0 && (
                                <span className="text-[10px] opacity-75 font-semibold">({completed}/{total})</span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Priority Tabs */}
                      <div className="flex flex-wrap gap-2 items-center text-xs font-bold text-gray-500">
                        <span className="mr-2 uppercase tracking-wider text-[10px] font-black text-gray-400">Priority:</span>
                        {['All', 'High', 'Medium', 'Low'].map(prio => (
                          <button
                            key={prio}
                            onClick={() => setCheckPriorityFilter(prio)}
                            className={`rounded-lg px-3 py-1 text-[11px] font-bold transition-all border ${
                              checkPriorityFilter === prio
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                : 'text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-white/5'
                            }`}
                          >
                            {prio === 'High' ? '🔴 High' : prio === 'Medium' ? '🟡 Medium' : prio === 'Low' ? '🟢 Low' : 'All'}
                          </button>
                        ))}
                      </div>
                    </div>
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
                      .filter(item => checkPriorityFilter === 'All' || item.priority === checkPriorityFilter)
                      .map((item, index) => {
                        const prioColor = item.priority === 'High' 
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                          : item.priority === 'Low' 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20';

                        const completedByArr = getCompletedByArray(item.completedBy);
                        const isMyCompleted = completedByArr.includes(currentUserName);
                        const isDoneInMyView = isMyCompleted || item.completed;

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.025 }}
                            onClick={() => handleToggleChecklist(item.id)}
                            className="glass-panel p-4 rounded-2xl cursor-pointer flex flex-col justify-between gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0 w-full">
                                <div className={`size-6 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                                  isDoneInMyView
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-white/[0.02]'
                                }`}>
                                  {isDoneInMyView && <span className="material-symbols-outlined text-[16px] font-bold">check</span>}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className={`text-sm font-black truncate ${isDoneInMyView ? 'checklist-item-title is-completed line-through text-gray-400 dark:text-gray-500' : 'checklist-item-title text-gray-900 dark:text-white'}`}>
                                      {item.name}
                                    </h4>
                                    {(item.quantity ?? 1) > 1 && (
                                      <span className="rounded bg-gray-100 dark:bg-white/10 px-1 py-0.5 text-[9px] font-black text-gray-500 dark:text-gray-400">
                                        ×{item.quantity}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className="checklist-item-badge rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                      {item.category}
                                    </span>
                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${prioColor}`}>
                                      {item.priority || 'Medium'}
                                    </span>
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 pl-1 border-l border-gray-200 dark:border-white/10">
                                      {renderAssigneeAvatars(item.assignedTo)}
                                      <span className="ml-1 text-[9px] font-semibold text-gray-400 max-w-16 truncate">
                                        {item.assignedTo === 'Everyone' ? 'Everyone' : item.assignedTo}
                                      </span>
                                    </div>
                                  </div>
                                  {completedByArr.length > 0 && (
                                    <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/10 w-fit">
                                      <span className="material-symbols-outlined text-[11px] font-black">done_all</span>
                                      <span>Done by: {completedByArr.join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openEditChecklist(item); }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-white transition-colors"
                                  title="Edit item"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteChecklist(item.id); }}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                                  title="Delete item"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </div>
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
                      );
                    })}
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
