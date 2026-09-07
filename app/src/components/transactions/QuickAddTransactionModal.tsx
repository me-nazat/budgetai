'use client';

import React from 'react';
import { MAX_ATTACHMENT_FILES } from '@/lib/transaction-attachments';
import { getCategoryIcon, getColorStyle, CUSTOM_COLORS } from '@/lib/categoryUtils';

interface QuickAddTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    qaType: 'expense' | 'earning';
    setQaType: (t: 'expense' | 'earning') => void;
    qaAmount: string;
    setQaAmount: (a: string) => void;
    qaCategory: string;
    setQaCategory: (c: string) => void;
    qaDesc: string;
    setQaDesc: (d: string) => void;
    qaDate: string;
    setQaDate: (d: string) => void;
    qaNotes: string;
    setQaNotes: (n: string) => void;
    qaAttachments: File[];
    setQaAttachments: React.Dispatch<React.SetStateAction<File[]>>;
    qaScanningId: number | null;
    qaSubmitting: boolean;
    submitQuickAdd: () => Promise<void>;
    sym: string;
    handleScanAttachment: (file: File, index: number) => Promise<void>;
    customCategories: any[];
    qaAddingCustomCategory: boolean;
    setQaAddingCustomCategory: (v: boolean) => void;
    qaCustomCategoryName: string;
    setQaCustomCategoryName: (n: string) => void;
    qaCustomIcon: string;
    setQaCustomIcon: (i: string) => void;
    qaCustomColor: string;
    setQaCustomColor: (c: string) => void;
    qaIconOptions: string[];
    generateInlineIconOptions: () => void;
}

export const QuickAddTransactionModal: React.FC<QuickAddTransactionModalProps> = ({
    isOpen,
    onClose,
    qaType,
    setQaType,
    qaAmount,
    setQaAmount,
    qaCategory,
    setQaCategory,
    qaDesc,
    setQaDesc,
    qaDate,
    setQaDate,
    qaNotes,
    setQaNotes,
    qaAttachments,
    setQaAttachments,
    qaScanningId,
    qaSubmitting,
    submitQuickAdd,
    sym,
    handleScanAttachment,
    customCategories,
    qaAddingCustomCategory,
    setQaAddingCustomCategory,
    qaCustomCategoryName,
    setQaCustomCategoryName,
    qaCustomIcon,
    setQaCustomIcon,
    qaCustomColor,
    setQaCustomColor,
    qaIconOptions,
    generateInlineIconOptions,
}) => {
    if (!isOpen) return null;

    const quickCategoriesForType =
        qaType === 'earning'
            ? ['Salary', 'Freelance', 'Investment', 'Business', 'Savings', 'Other']
            : ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Education', 'Other'];

    const parsedAmount = parseFloat(qaAmount);
    const isValid = !isNaN(parsedAmount) && parsedAmount > 0 && (qaAddingCustomCategory ? !!qaCustomCategoryName.trim() : !!qaCategory);

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                submitQuickAdd();
            }}
            className="glass-panel mb-6 overflow-hidden rounded-3xl animate-slide-up border border-gray-150 dark:border-white/10 shadow-xl"
        >
            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
                {/* Left Panel: Primary Inputs & Amount */}
                <div className={`relative p-5 lg:p-6 ${qaType === 'expense' ? 'stat-gradient-orange' : 'stat-gradient-emerald'}`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-text-muted">New Entry</p>
                            <h3 className="mt-0.5 text-xl font-black text-gray-900 dark:text-white">
                                {qaType === 'expense' ? 'Record Expense' : 'Record Earning'}
                            </h3>
                        </div>
                        <div
                            className={`grid h-12 w-12 place-items-center rounded-2xl ${
                                qaType === 'expense' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                            }`}
                        >
                            <span className="material-symbols-outlined text-2xl">
                                {qaType === 'expense' ? 'shopping_cart' : 'payments'}
                            </span>
                        </div>
                    </div>

                    <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-1 dark:bg-black/20">
                        {(['expense', 'earning'] as const).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => {
                                    setQaType(type);
                                    setQaCategory('');
                                    setQaAddingCustomCategory(false);
                                }}
                                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                                    qaType === type
                                        ? type === 'expense'
                                            ? 'bg-rose-500 text-white shadow-sm'
                                            : 'bg-emerald-500 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    {type === 'expense' ? 'arrow_downward' : 'arrow_upward'}
                                </span>
                                {type === 'expense' ? 'Expense' : 'Earning'}
                            </button>
                        ))}
                    </div>

                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">
                        Amount
                    </label>
                    <div className="relative mb-4">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400 dark:text-gray-500">
                            {sym}
                        </span>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={qaAmount}
                            onChange={(e) => setQaAmount(e.target.value)}
                            className="w-full rounded-2xl border border-gray-200 bg-white/85 py-3.5 pl-12 pr-4 text-3xl font-black tracking-tight text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#0A0E1A]/80 dark:text-white"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">
                                Date
                            </label>
                            <input
                                type="date"
                                value={qaDate}
                                onChange={(e) => setQaDate(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white/85 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-[#0A0E1A]/80 dark:text-white font-medium"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">
                                Description
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Grocery store, Salary"
                                value={qaDesc}
                                onChange={(e) => setQaDesc(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white/85 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-[#0A0E1A]/80 dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Optional Note */}
                    <div className="mt-3">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">
                            Additional Notes (Optional)
                        </label>
                        <textarea
                            value={qaNotes}
                            onChange={(e) => setQaNotes(e.target.value)}
                            placeholder="Tags, location, memo..."
                            rows={2}
                            className="w-full resize-none rounded-xl border border-gray-200 bg-white/85 px-3 py-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-[#0A0E1A]/80 dark:text-white"
                        />
                    </div>

                    {/* Receipt Attachments */}
                    <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">
                                Attachments
                            </label>
                            <span className="text-[11px] text-gray-400">
                                {qaAttachments.length}/{MAX_ATTACHMENT_FILES}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {qaAttachments.map((file, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-1 text-xs dark:border-white/10 dark:bg-[#0A0E1A]"
                                >
                                    <span className="material-symbols-outlined text-gray-500 text-[14px]">
                                        {file.type.startsWith('image/') ? 'image' : 'description'}
                                    </span>
                                    <span className="max-w-[80px] truncate text-gray-700 dark:text-gray-300">{file.name}</span>

                                    {(file.type.startsWith('image/') || file.type === 'application/pdf') && (
                                        <button
                                            type="button"
                                            onClick={() => handleScanAttachment(file, idx)}
                                            disabled={qaScanningId === idx}
                                            className="ml-1 flex items-center gap-0.5 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-600 hover:bg-teal-200 disabled:opacity-50 dark:bg-teal-500/20 dark:text-teal-300"
                                        >
                                            {qaScanningId === idx ? 'Scanning...' : 'Scan'}
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setQaAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                        className="text-gray-400 hover:text-rose-500"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            ))}
                            {qaAttachments.length < MAX_ATTACHMENT_FILES && (
                                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition-all">
                                    <span className="material-symbols-outlined text-[14px]">attach_file</span>
                                    Attach Receipt
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        accept="image/*,application/pdf"
                                        onChange={(e) => {
                                            if (!e.target.files?.length) return;
                                            const newFiles = Array.from(e.target.files);
                                            if (qaAttachments.length + newFiles.length > MAX_ATTACHMENT_FILES) {
                                                alert(`Max ${MAX_ATTACHMENT_FILES} files allowed.`);
                                                return;
                                            }
                                            setQaAttachments((prev) => [...prev, ...newFiles]);
                                            e.target.value = '';
                                        }}
                                    />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Category Selection */}
                <div className="p-5 lg:p-6 flex flex-col justify-between">
                    <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-text-muted">Category</p>
                                <p className="text-xs text-gray-400">
                                    {qaAddingCustomCategory ? 'Create custom category' : 'Choose a category group'}
                                </p>
                            </div>
                            {qaAddingCustomCategory && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQaAddingCustomCategory(false);
                                        setQaCustomCategoryName('');
                                        setQaCategory('');
                                    }}
                                    className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500 hover:text-rose-500 dark:bg-surface-dark"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            )}
                        </div>

                        {!qaAddingCustomCategory ? (
                            <div className="flex flex-wrap gap-2">
                                {quickCategoriesForType.map((category) => {
                                    const selected = qaCategory === category;
                                    return (
                                        <button
                                            key={category}
                                            type="button"
                                            onClick={() => {
                                                setQaCategory(category);
                                                setQaAddingCustomCategory(false);
                                            }}
                                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                                                selected
                                                    ? 'border-primary bg-primary text-white shadow-sm'
                                                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:bg-black/20 dark:text-gray-300 dark:hover:text-white'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">
                                                {getCategoryIcon(category, customCategories)}
                                            </span>
                                            {category}
                                        </button>
                                    );
                                })}

                                {customCategories
                                    .filter((c) => c.type === qaType)
                                    .map((category) => {
                                        const selected = qaCategory.toLowerCase() === category.name.toLowerCase();
                                        return (
                                            <button
                                                key={category.id}
                                                type="button"
                                                onClick={() => setQaCategory(category.name)}
                                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                                                    selected
                                                        ? getColorStyle(category.color).selected
                                                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:bg-black/20 dark:text-gray-300 dark:hover:text-white'
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">{category.icon}</span>
                                                {category.name}
                                            </button>
                                        );
                                    })}

                                <button
                                    type="button"
                                    onClick={() => {
                                        setQaAddingCustomCategory(true);
                                        setQaCategory('');
                                    }}
                                    className="flex items-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    New Category
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-black/30">
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">
                                        Category Name
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                                                qaCustomCategoryName.trim() ? getColorStyle(qaCustomColor).bg : 'bg-gray-300 dark:bg-gray-700'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-lg text-white">
                                                {qaCustomCategoryName.trim() ? qaCustomIcon : 'edit'}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="e.g. Subscriptions, Gaming"
                                            value={qaCustomCategoryName}
                                            onChange={(e) => {
                                                setQaCustomCategoryName(e.target.value);
                                                setQaCategory(e.target.value);
                                            }}
                                            className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">
                                            Choose Icon
                                        </label>
                                        <button
                                            type="button"
                                            onClick={generateInlineIconOptions}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                                        >
                                            <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                                            Smart suggest
                                        </button>
                                    </div>
                                    <div className="grid max-h-32 grid-cols-6 gap-1.5 overflow-y-auto rounded-2xl border border-gray-200 bg-white/50 p-2 dark:border-white/10 dark:bg-black/20 custom-scrollbar">
                                        {qaIconOptions.map((icon) => (
                                            <button
                                                key={icon}
                                                type="button"
                                                onClick={() => setQaCustomIcon(icon)}
                                                className={`grid h-8 w-8 place-items-center rounded-lg text-sm transition-all ${
                                                    qaCustomIcon === icon
                                                        ? 'bg-primary text-white shadow-sm'
                                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">
                                        Color Accent
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {CUSTOM_COLORS.map((col) => (
                                            <button
                                                key={col}
                                                type="button"
                                                onClick={() => setQaCustomColor(col)}
                                                className={`h-7 w-7 rounded-full transition-transform ${getColorStyle(col).bg} ${
                                                    qaCustomColor === col ? 'scale-125 ring-2 ring-primary ring-offset-2' : 'hover:scale-110'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={qaSubmitting || !isValid}
                            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-40"
                        >
                            {qaSubmitting ? (
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            )}
                            <span>Add Transaction</span>
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
};
