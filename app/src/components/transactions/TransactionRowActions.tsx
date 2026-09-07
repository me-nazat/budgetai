'use client';

import React, { useRef, useEffect } from 'react';

export interface TransactionActionItem {
    id: number | string;
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description?: string;
    date: string;
    created_at?: string;
    pending?: boolean;
}

interface TransactionRowActionsProps {
    transaction: TransactionActionItem;
    onView: (tx: TransactionActionItem) => void;
    onEdit: (tx: TransactionActionItem) => void;
    onDuplicate: (tx: TransactionActionItem) => void;
    onDelete: (id: number | string) => void;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
}

export const TransactionRowActions: React.FC<TransactionRowActionsProps> = ({
    transaction,
    onView,
    onEdit,
    onDuplicate,
    onDelete,
    isOpen,
    onToggle,
    onClose,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    return (
        <div className="relative inline-block text-left" ref={containerRef} onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                title="Options"
            >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-36 origin-top-right rounded-2xl border border-gray-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#161b22]/95 animate-fade-in">
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onView(transaction);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                        <span>Details</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onEdit(transaction);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-amber-500">edit</span>
                        <span>Edit</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onDuplicate(transaction);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px] text-teal-500">content_copy</span>
                        <span>Duplicate</span>
                    </button>

                    <div className="my-1 border-t border-gray-100 dark:border-white/10" />

                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onDelete(transaction.id);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Delete</span>
                    </button>
                </div>
            )}
        </div>
    );
};
