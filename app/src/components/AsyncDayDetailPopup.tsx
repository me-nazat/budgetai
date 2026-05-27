'use client';

import { useState } from 'react';
import useSWR from 'swr';
import DayDetailPopup from './DayDetailPopup';
import QuickAddModal from './QuickAddModal';
import TransactionDetailModal from './TransactionDetailModal';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';

interface Transaction {
    id: number;
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description: string;
    date: string;
    notes?: string;
}

interface RecurringItem {
    id: number;
    name: string;
    type: 'expense' | 'earning' | string;
    amount: number;
    category: string;
    frequency: string;
    next_date: string;
    active: number;
}

interface AsyncDayDetailPopupProps {
    date: string;
    anchorEl: HTMLElement;
    onClose: () => void;
}

export default function AsyncDayDetailPopup({ date, anchorEl, onClose }: AsyncDayDetailPopupProps) {
    const { data: txData } = useSWR<{ transactions: Transaction[] }>(`/api/transactions?start=${date}&end=${date}&limit=1000`);
    const { data: recurringData } = useSWR<{ items: RecurringItem[] }>(`/api/recurring`);
    const { categories: customCategories } = useCustomCategories('all');
    const invalidateData = useInvalidateFinancialData();
    
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formModalDate, setFormModalDate] = useState<string | undefined>(undefined);
    const [formModalTx, setFormModalTx] = useState<Transaction | null>(null);
    const [showPopup, setShowPopup] = useState(true);

    const dayTransactions = txData?.transactions || [];
    const recurringItems = (recurringData?.items || []).filter((r) => {
        if (!r.active) return false;
        return r.next_date === date || new Date(r.next_date).toISOString().split('T')[0] === date;
    });

    const handleAddClick = (d: string) => {
        setShowPopup(false);
        setFormModalDate(d);
        setFormModalTx(null);
        setIsFormModalOpen(true);
    };

    const handleTransactionClick = (tx: Transaction) => {
        setShowPopup(false);
        setSelectedTx(tx);
    };

    const handleCloseModal = () => {
        setSelectedTx(null);
        onClose(); // Unmount AsyncDayDetailPopup completely since edit action is finished
    };

    const handleFormModalClose = () => {
        setIsFormModalOpen(false);
        setFormModalTx(null);
        setFormModalDate(undefined);
        onClose(); // Unmount AsyncDayDetailPopup completely since add action is finished
    };

    return (
        <>
            {showPopup && (
                <DayDetailPopup
                    date={date}
                    anchorEl={anchorEl}
                    transactions={dayTransactions}
                    recurringItems={recurringItems}
                    customCategories={customCategories}
                    onClose={onClose}
                    onTransactionClick={handleTransactionClick}
                    onAddClick={handleAddClick}
                    compact={true}
                />
            )}

            {/* View/Edit Modal (opened from popup) */}
            {selectedTx && (
                <TransactionDetailModal
                    transaction={selectedTx}
                    customCategories={customCategories}
                    onClose={handleCloseModal}
                    onEdit={(tx) => {
                        setSelectedTx(null);
                        setFormModalTx(tx);
                        setIsFormModalOpen(true);
                    }}
                    onDuplicate={(tx) => {
                        const duplicateTx: Transaction = { ...tx, id: undefined as unknown as number, date: new Date().toISOString().split('T')[0] };
                        setSelectedTx(null);
                        setFormModalDate(undefined);
                        setFormModalTx(duplicateTx);
                        setIsFormModalOpen(true);
                    }}
                    onDelete={async (tx) => {
                        if (confirm('Are you sure you want to delete this transaction?')) {
                            await fetch(`/api/transactions?id=${tx.id}`, { method: 'DELETE' });
                            await invalidateData();
                            handleCloseModal();
                        }
                    }}
                    onNotesChange={async (_id, _notes) => {
                        await invalidateData();
                    }}
                />
            )}

            {/* Unified Add / Edit Form Modal */}
            <QuickAddModal 
                isOpen={isFormModalOpen}
                onClose={handleFormModalClose}
                initialTransaction={formModalTx}
                initialDate={formModalDate}
                onSaveSuccess={async () => {
                    await invalidateData();
                }}
            />
        </>
    );
}
