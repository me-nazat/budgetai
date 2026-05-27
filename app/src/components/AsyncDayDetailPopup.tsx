'use client';

import { useState } from 'react';
import useSWR from 'swr';
import DayDetailPopup from './DayDetailPopup';
import QuickAddModal from './QuickAddModal';
import TransactionDetailModal from './TransactionDetailModal';

interface AsyncDayDetailPopupProps {
    date: string;
    anchorEl: HTMLElement;
    onClose: () => void;
}

export default function AsyncDayDetailPopup({ date, anchorEl, onClose }: AsyncDayDetailPopupProps) {
    const { data: txData, isLoading } = useSWR(`/api/transactions?start=${date}&end=${date}&limit=1000`);
    const { data: recurringData } = useSWR(`/api/recurring`);
    
    const [selectedTx, setSelectedTx] = useState<any | null>(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formModalDate, setFormModalDate] = useState<string | undefined>(undefined);
    const [formModalTx, setFormModalTx] = useState<any | null>(null);

    const dayTransactions = txData?.transactions || [];
    const recurringItems = (recurringData?.items || []).filter((r: any) => {
        if (!r.active) return false;
        return r.next_date === date || new Date(r.next_date).toISOString().split('T')[0] === date;
    });

    return (
        <>
            <DayDetailPopup
                date={date}
                anchorEl={anchorEl}
                transactions={dayTransactions}
                recurringItems={recurringItems}
                onClose={onClose}
                onTransactionClick={(tx) => { onClose(); setSelectedTx(tx); }}
                onAddClick={(d) => { onClose(); setFormModalDate(d); setFormModalTx(null); setIsFormModalOpen(true); }}
            />

            {/* View/Edit Modal (opened from popup) */}
            <TransactionDetailModal
                isOpen={!!selectedTx}
                onClose={() => setSelectedTx(null)}
                transaction={selectedTx}
                onEdit={(tx) => { setSelectedTx(null); setFormModalTx(tx); setIsFormModalOpen(true); }}
                onDuplicate={(duplicateTx) => {
                    setSelectedTx(null); setFormModalDate(undefined); setFormModalTx(duplicateTx); setIsFormModalOpen(true);
                }}
            />

            {/* Unified Add / Edit Form Modal */}
            <QuickAddModal 
                isOpen={isFormModalOpen}
                onClose={() => { setIsFormModalOpen(false); setFormModalTx(null); setFormModalDate(undefined); }}
                initialTransaction={formModalTx}
                initialDate={formModalDate}
            />
        </>
    );
}
