'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queueTransaction } from '@/lib/offlineDb';
import {
    CATEGORIES_EXPENSE, CATEGORIES_INCOME,
    CUSTOM_COLORS,
    CUSTOM_CATEGORY_ICONS,
    getColorStyle, getIconCandidates, resolveIcon, resolveColor,
} from '@/lib/categoryUtils';
import { MAX_ATTACHMENT_FILES } from '@/lib/transaction-attachments';

interface CustomCategory {
    id: number;
    name: string;
    type: string;
    icon: string;
    color: string;
}

interface CategoryOption {
    label: string;
    icon: string;
    color?: string;
    isCustom?: boolean;
    id?: number;
}

interface QuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function QuickAddModal({ isOpen, onClose }: QuickAddModalProps) {
    const [type, setType] = useState<'expense' | 'earning'>('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [descriptionError, setDescriptionError] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [qaScanningId, setQaScanningId] = useState<number | null>(null);
    const invalidateFinancialData = useInvalidateFinancialData();
    
    // Custom Categories State
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
    const [isCreatingCustom, setIsCreatingCustom] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customIcon, setCustomIcon] = useState(CUSTOM_CATEGORY_ICONS[0]);
    const [customColor, setCustomColor] = useState(CUSTOM_COLORS[0]);
    const [generatedIcons, setGeneratedIcons] = useState(CUSTOM_CATEGORY_ICONS.slice(0, 40));
    const [showRecentCustom, setShowRecentCustom] = useState(false);

    const { currency } = useCurrency();
    const sym = CURRENCIES[currency].symbol;
    const { isOnline } = useNetworkStatus();

    const fetchCustomCategories = useCallback(async () => {
        try {
            const res = await fetch(`/api/categories?type=${type}`);
            const data = await res.json();
            if (data.categories) setCustomCategories(data.categories);
        } catch (e) {
            console.error('Failed to fetch custom categories', e);
        }
    }, [type]);

    useEffect(() => {
        if (isOpen) {
            fetchCustomCategories();
        } else {
            setQaScanningId(null);
        }
    }, [fetchCustomCategories, isOpen]);

    // Smart auto-resolve: update icon & color as user types custom category name
    useEffect(() => {
        if (customName.trim()) {
            const suggestedIcon = resolveIcon(customName);
            const suggestedColor = resolveColor(customName);
            setCustomIcon(suggestedIcon);
            setCustomColor(suggestedColor);
            setGeneratedIcons(getIconCandidates(customName));
        }
    }, [customName]);

    const handleScanAttachment = async (file: File, index: number) => {
        setQaScanningId(index);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/transactions/scan', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Scan failed');
            const data = await res.json();
            
            if (data.amount) setAmount(data.amount.toString());
            if (data.date) setDate(data.date);
            if (data.description) setDescription(data.description);
            if (data.category) setCategory(data.category);
            if (data.type === 'earning' || data.type === 'expense') setType(data.type);
        } catch (error) {
            console.error('Failed to scan attachment:', error);
            alert('Failed to extract data from image.');
        } finally {
            setQaScanningId(null);
        }
    };

    const standardCategories = type === 'expense' ? CATEGORIES_EXPENSE : CATEGORIES_INCOME;
    const allCategories: CategoryOption[] = useMemo(() => [
        ...standardCategories,
        ...customCategories.map(c => ({
            label: c.name,
            icon: c.icon,
            color: c.color,
            isCustom: true,
            id: c.id
        }))
    ], [customCategories, standardCategories]);

    const resetForm = () => {
        setAmount('');
        setCategory('');
        setDescription('');
        setNotes('');
        setDescriptionError(false);
        setDate(new Date().toISOString().split('T')[0]);
        setType('expense');
        setAttachments([]);
        setIsCreatingCustom(false);
        setShowRecentCustom(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSaveCustomCategory = async () => {
        const trimmedName = customName.trim().replace(/\s+/g, ' ');
        if (!trimmedName) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    type,
                    icon: customIcon,
                    color: customColor
                })
            });
            const data = await res.json();
            if (res.ok) {
                await fetchCustomCategories();
                setCategory(data.name || trimmedName);
                setIsCreatingCustom(false);
                setCustomName('');
            } else if (data.error === 'Category already exists') {
                await fetch('/api/categories', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: trimmedName, type, icon: customIcon, color: customColor })
                });
                await fetchCustomCategories();
                setCategory(trimmedName);
                setIsCreatingCustom(false);
                setCustomName('');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCustomButtonClick = () => {
        if (customCategories.length > 0) {
            setShowRecentCustom(true);
        } else {
            setIsCreatingCustom(true);
        }
    };

    const generateIconOptions = () => {
        const candidates = getIconCandidates(customName || category || type);
        setGeneratedIcons(candidates);
        setCustomIcon(candidates[0]);
    };

    const handleSelectRecentCustom = (catName: string) => {
        setCategory(catName);
        setShowRecentCustom(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const newFiles = Array.from(e.target.files);
        if (attachments.length + newFiles.length > MAX_ATTACHMENT_FILES) {
            alert(`You can attach up to ${MAX_ATTACHMENT_FILES} files.`);
            return;
        }
        setAttachments(prev => [...prev, ...newFiles]);
        e.target.value = ''; // Reset input
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        const parsed = parseFloat(amount);
        if (!description.trim()) {
            setDescriptionError(true);
            return;
        }
        setDescriptionError(false);
        if (!amount || isNaN(parsed) || parsed <= 0 || !category) return;
        setSubmitting(true);

        const payload = {
            actionType: 'add' as const,
            type,
            amount: parsed,
            category,
            description: description.trim(),
            date,
            notes: notes.trim() || undefined,
        };

        try {
            if (isOnline) {
                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                
                const data = await res.json();
                
                if (data.id && attachments.length > 0) {
                    const form = new FormData();
                    attachments.forEach(file => form.append('attachments', file));
                    await fetch(`/api/transactions/${data.id}/attachments`, {
                        method: 'POST',
                        body: form
                    });
                }
                
                // Fire and forget cache invalidation
                invalidateFinancialData();
            } else {
                await queueTransaction(payload);
            }

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                handleClose();
            }, 300); // Drastically reduced for faster UX
        } catch {
            alert('Failed to save. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteCustomCategory = async (id: number, catName: string) => {
        if (!confirm('Delete this custom category? (Existing transactions will keep the text)')) return;
        try {
            await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
            if (category === catName) setCategory('');
            fetchCustomCategories();
        } catch (e) {
            console.error(e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="lg:hidden fixed inset-0 z-[60] flex items-end justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={handleClose}
            />

            {/* Modal Sheet */}
            <div
                className="relative w-full max-h-[90dvh] bg-white dark:bg-[#161b22] rounded-t-3xl overflow-y-auto"
                style={{ animation: 'sheetSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                <div className="px-6 pb-8 pt-2">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {isCreatingCustom ? 'New Custom Category' : showRecentCustom ? 'Custom Categories' : 'Add Transaction'}
                        </h2>
                        <button
                            onClick={() => {
                                if (isCreatingCustom) { setIsCreatingCustom(false); }
                                else if (showRecentCustom) { setShowRecentCustom(false); }
                                else { handleClose(); }
                            }}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-lg text-gray-500 dark:text-gray-400">
                                {isCreatingCustom || showRecentCustom ? 'arrow_back' : 'close'}
                            </span>
                        </button>
                    </div>

                    {/* ─── Recent Custom Categories Picker ─── */}
                    {showRecentCustom && !isCreatingCustom ? (
                        <div className="animate-fade-in">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                Select a saved custom category or create new
                            </p>
                            <div className="flex flex-wrap gap-2.5 mb-6">
                                {customCategories.map(cat => {
                                    const isSelected = category === cat.name;
                                    const colorStyle = getColorStyle(cat.color);
                                    return (
                                        <div key={cat.id} className="relative group/cat">
                                            <button
                                                onClick={() => handleSelectRecentCustom(cat.name)}
                                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${isSelected
                                                    ? colorStyle.selected
                                                    : 'bg-gray-100 dark:bg-[#0d1117] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#30363d] hover:border-gray-300 dark:hover:border-gray-500'
                                                    }`}
                                            >
                                                <span className={`material-symbols-outlined text-[18px] ${!isSelected ? colorStyle.text : ''}`}>
                                                    {cat.icon}
                                                </span>
                                                {cat.name}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteCustomCategory(cat.id, cat.name); }}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full hidden group-hover/cat:flex items-center justify-center text-[10px] shadow"
                                            >
                                                <span className="material-symbols-outlined text-[12px]">close</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Create New Button */}
                            <button
                                onClick={() => setIsCreatingCustom(true)}
                                className="w-full py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                                Create New Custom Category
                            </button>
                        </div>
                    ) : !isCreatingCustom ? (
                        <>
                            {/* Type Toggle */}
                            <div className="flex bg-gray-100 dark:bg-[#0d1117] rounded-xl p-1 mb-6">
                                <button
                                    onClick={() => { setType('expense'); setCategory(''); setIsCreatingCustom(false); setShowRecentCustom(false); }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'expense'
                                        ? 'bg-rose-500 text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    Expense
                                </button>
                                <button
                                    onClick={() => { setType('earning'); setCategory(''); setIsCreatingCustom(false); setShowRecentCustom(false); }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'earning'
                                        ? 'bg-emerald-500 text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    Income
                                </button>
                            </div>

                            {/* Amount & Date Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                {/* Amount Input */}
                                <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400 dark:text-gray-500">{sym}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-12 pr-4 py-4 text-3xl font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] rounded-2xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-center"
                                        autoFocus
                                    />
                                    </div>
                                </div>

                                {/* Date Picker */}
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                                    />
                                </div>
                            </div>

                            {/* Category Pills */}
                            <div className="mb-5">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {allCategories.map(cat => {
                                        const isSelected = category === cat.label;
                                        // Dynamic color styling for custom categories ONLY when selected
                                        let selectedBg = type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'bg-emerald-500 text-white shadow-sm';
                                        if (isSelected && cat.color) {
                                            selectedBg = getColorStyle(cat.color).selected;
                                        }

                                        return (
                                            <div key={cat.label} className="relative group/cat">
                                                <button
                                                    onClick={() => setCategory(cat.label)}
                                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${isSelected
                                                        ? selectedBg
                                                        : 'bg-gray-100 dark:bg-[#0d1117] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#30363d]'
                                                        }`}
                                                >
                                                    <span className={`material-symbols-outlined text-[16px] ${!isSelected && cat.color ? getColorStyle(cat.color).text : ''}`}>
                                                        {cat.icon}
                                                    </span>
                                                    {cat.label}
                                                </button>
                                                {cat.isCustom && cat.id !== undefined && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); deleteCustomCategory(cat.id!, cat.label); }}
                                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full hidden group-hover/cat:flex items-center justify-center text-[10px] shadow"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">close</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Custom Category Button */}
                                    <button
                                        onClick={handleCustomButtonClick}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                        Custom
                                        {customCategories.length > 0 && (
                                            <span className="ml-0.5 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                                                {customCategories.length}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Description (Required) */}
                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    What was this for? <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => { setDescription(e.target.value); if (e.target.value.trim()) setDescriptionError(false); }}
                                    placeholder="e.g. Lunch with friends"
                                    className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all ${
                                        descriptionError
                                            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/20'
                                            : 'border-gray-200 dark:border-[#30363d] focus:border-primary'
                                    }`}
                                />
                                {descriptionError && (
                                    <p className="mt-1.5 text-xs font-medium text-rose-500 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                        Please describe this transaction
                                    </p>
                                )}
                            </div>

                            {/* Additional Notes (Optional) */}
                            <div className="mb-5">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Add more details <span className="text-gray-400 dark:text-gray-500 font-normal normal-case">(optional)</span></label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Additional notes, receipt info, context..."
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm resize-none"
                                />
                            </div>

                            {/* Attachments */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attachments</label>
                                    <span className="text-xs text-gray-400">{attachments.length}/{MAX_ATTACHMENT_FILES}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {attachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm border border-gray-200 dark:border-gray-700">
                                            <span className="material-symbols-outlined text-gray-500 text-[16px]">
                                                {file.type.startsWith('image/') ? 'image' : 'description'}
                                            </span>
                                            <span className="max-w-[100px] truncate text-gray-700 dark:text-gray-300">{file.name}</span>
                                            
                                            {(file.type.startsWith('image/') || file.type === 'application/pdf') && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleScanAttachment(file, idx)}
                                                    disabled={qaScanningId === idx}
                                                    className="ml-1 flex items-center gap-1 rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-600 hover:bg-teal-200 disabled:opacity-50 dark:bg-teal-500/20 dark:text-teal-300"
                                                >
                                                    {qaScanningId === idx ? 'Scanning...' : 'Scan'}
                                                    <span className="material-symbols-outlined text-[12px]">document_scanner</span>
                                                </button>
                                            )}

                                            <button 
                                                type="button" 
                                                onClick={() => removeAttachment(idx)}
                                                className="ml-1 flex items-center justify-center text-gray-400 hover:text-rose-500"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {attachments.length < MAX_ATTACHMENT_FILES && (
                                        <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
                                            <span className="material-symbols-outlined text-[16px]">attach_file</span>
                                            Attach File
                                            <input 
                                                type="file" 
                                                multiple 
                                                className="hidden" 
                                                onChange={handleFileSelect}
                                                accept="image/*,application/pdf"
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={submitting || !amount || !category || !description.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
                                className={`w-full py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-40 active:scale-[0.98] ${type === 'expense'
                                    ? 'bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/25'
                                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
                                    }`}
                            >
                                {showSuccess ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined">check_circle</span>
                                        Saved!
                                    </span>
                                ) : submitting ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                                ) : (
                                    `Save ${type === 'expense' ? 'Expense' : 'Income'}`
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="animate-fade-in">
                            {/* Create Custom Category Form */}

                            {/* Category Name with Live Icon Preview */}
                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Category Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        placeholder="e.g. Coffee, Gym, Pets, Crypto"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm"
                                        autoFocus
                                    />
                                    {/* Live Icon Preview */}
                                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${customName.trim() ? getColorStyle(customColor).bg : 'bg-gray-200 dark:bg-gray-700'}`}>
                                        <span className="material-symbols-outlined text-white text-[16px]">
                                            {customName.trim() ? customIcon : 'edit'}
                                        </span>
                                    </div>
                                </div>
                                {customName.trim() && (
                                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px] text-emerald-500">auto_awesome</span>
                                        Auto-matched icon: <span className="font-semibold text-gray-600 dark:text-gray-300">{customIcon}</span>
                                    </p>
                                )}
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Color</label>
                                <div className="flex flex-wrap gap-3">
                                    {CUSTOM_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setCustomColor(color)}
                                            className={`w-8 h-8 rounded-full ${getColorStyle(color).bg} flex items-center justify-center transition-all ${
                                                customColor === color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#161b22] ring-gray-900 dark:ring-white scale-110' : 'hover:scale-110'
                                            }`}
                                        >
                                            {customColor === color && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Icon
                                        <span className="ml-2 text-[10px] font-normal normal-case text-gray-400">(40 choices)</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={generateIconOptions}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                                        Generate icon
                                    </button>
                                </div>
                                <div className="grid grid-cols-6 gap-3">
                                    {generatedIcons.map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => setCustomIcon(icon)}
                                            className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                                                customIcon === icon 
                                                ? `${getColorStyle(customColor).bg} text-white shadow-md scale-110`
                                                : 'bg-gray-100 dark:bg-[#0d1117] text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Live Preview Card */}
                            {customName.trim() && (
                                <div className="mb-6 p-4 rounded-xl bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d]">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Preview</p>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getColorStyle(customColor).bg}`}>
                                            <span className="material-symbols-outlined text-white text-xl">{customIcon}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{customName}</p>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{type === 'expense' ? 'Expense' : 'Income'} Category</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleSaveCustomCategory}
                                disabled={submitting || !customName.trim()}
                                className="w-full py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-base transition-all disabled:opacity-40 active:scale-[0.98]"
                            >
                                {submitting ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" /> : 'Create Category'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
