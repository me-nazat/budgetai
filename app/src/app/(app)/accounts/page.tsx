'use client';

import { useEffect, useState, useTransition } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Account {
  id: number;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'mobile_wallet' | 'other';
  currency: string;
  openingBalance: number;
  currentBalance: number;
  colorTag: string;
  isArchived: number;
  createdAt: string;
}

export default function AccountsPage() {
  const { fmt } = useCurrency();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Modal / Bottom sheet states
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  
  // Account Form State
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'cash' | 'bank' | 'card' | 'mobile_wallet' | 'other'>('bank');
  const [accountCurrency, setAccountCurrency] = useState('BDT');
  const [openingBalance, setOpeningBalance] = useState('');
  const [colorTag, setColorTag] = useState('#136dec');

  // Transfer Form State
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);

  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const openAddAccount = () => {
    setEditingAccount(null);
    setAccountName('');
    setAccountType('bank');
    setAccountCurrency('BDT');
    setOpeningBalance('0');
    setColorTag('#136dec');
    setIsAccountModalOpen(true);
  };

  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setAccountName(acc.name);
    setAccountType(acc.type);
    setAccountCurrency(acc.currency);
    setOpeningBalance(String(acc.openingBalance));
    setColorTag(acc.colorTag);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      toast.error('Account name is required');
      return;
    }

    const payload = {
      name: accountName,
      type: accountType,
      currency: accountCurrency,
      openingBalance: parseFloat(openingBalance || '0'),
      colorTag,
    };

    const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts';
    const method = editingAccount ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save account');

      toast.success(editingAccount ? 'Account updated' : 'Account created');
      setIsAccountModalOpen(false);
      void loadAccounts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleArchiveAccount = async (acc: Account) => {
    const confirmMsg = acc.isArchived 
      ? `Are you sure you want to unarchive "${acc.name}"?` 
      : `Are you sure you want to archive "${acc.name}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/accounts/${acc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !acc.isArchived }),
      });
      if (!res.ok) throw new Error('Failed to update account status');
      toast.success(acc.isArchived ? 'Account unarchived' : 'Account archived');
      void loadAccounts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || !transferAmount) {
      toast.error('All fields are required');
      return;
    }
    if (fromAccountId === toAccountId) {
      toast.error('Source and destination accounts must be different');
      return;
    }
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const payload = {
      type: 'transfer',
      amount,
      category: 'Transfer',
      description: transferDesc || 'Fund Transfer',
      date: transferDate,
      accountId: parseInt(fromAccountId, 10),
      toAccountId: parseInt(toAccountId, 10),
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Transfer failed');

      toast.success('Funds transferred successfully!');
      setIsTransferModalOpen(false);
      setTransferAmount('');
      setTransferDesc('');
      void loadAccounts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'cash': return 'payments';
      case 'bank': return 'account_balance';
      case 'card': return 'credit_card';
      case 'mobile_wallet': return 'phone_android';
      default: return 'wallet';
    }
  };

  const netBalance = accounts.reduce((acc, curr) => {
    if (curr.isArchived) return acc;
    if (curr.type === 'card') {
      // Credit cards represent liabilities (subtract from net assets)
      return acc - curr.currentBalance;
    }
    return acc + curr.currentBalance;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 dark:bg-[#0A0E1B] text-gray-900 dark:text-white transition-colors duration-300">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight font-outfit">My Accounts & Wallets</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage bank accounts, credit cards, cash, and mobile money wallets.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 text-sm font-semibold transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
              Transfer Funds
            </button>
            <button
              onClick={openAddAccount}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-lg shadow-primary/25 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add Account
            </button>
          </div>
        </div>

        {/* Net Worth Summary Card */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm dark:border-white/10 dark:from-white/5 dark:to-white/[0.02] mb-8">
          <div className="absolute top-[-10%] right-[-10%] w-[30%] h-[50%] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
          <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold tracking-wider">Total Combined Balance</p>
          <h2 className="text-4xl font-black mt-2 font-outfit tracking-tight text-primary">
            {fmt(netBalance, 'BDT')}
          </h2>
        </div>

        {/* Accounts Cards List */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-gray-200 dark:bg-white/5" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
            <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-gray-500 animate-bounce">account_balance_wallet</span>
            <h3 className="text-lg font-bold mt-4">No accounts added yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm">Create your first account to start tracking bank deposits, cash spending, and card statements.</p>
            <button
              onClick={openAddAccount}
              className="mt-6 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-gray-200 bg-white/40 p-6 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-black/20 hover:shadow-md transition-shadow group"
              >
                {/* Visual indicator tag */}
                <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: acc.colorTag }} />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm dark:bg-white/10 dark:text-white" style={{ color: acc.colorTag }}>
                      <span className="material-symbols-outlined text-[22px]">{getAccountIcon(acc.type)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[150px]">{acc.name}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-[10px] uppercase font-bold mt-0.5 tracking-wider">{acc.type.replace('_', ' ')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditAccount(acc)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
                      title="Edit Account"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => handleArchiveAccount(acc)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 hover:text-rose-500 transition-colors"
                      title={acc.isArchived ? 'Unarchive' : 'Archive'}
                    >
                      <span className="material-symbols-outlined text-[18px]">{acc.isArchived ? 'unarchive' : 'archive'}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-8">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Current Balance</p>
                  <p className="text-2xl font-black mt-1 font-outfit tracking-tight" style={{ color: acc.type === 'card' ? '#FF2A5F' : undefined }}>
                    {acc.type === 'card' ? '-' : ''}{fmt(acc.currentBalance, acc.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slide-out Bottom Sheet (Mobile) & Modal Overlay (Desktop) for Account Form */}
      <AnimatePresence>
        {isAccountModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAccountModalOpen(false)}
              className="fixed inset-0 bg-slate-950/50 z-50 backdrop-blur-sm"
            />
            {/* Form Sheet / Modal Container */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 w-full rounded-t-[2rem] border-t border-gray-200 bg-white p-6 shadow-2xl z-50 dark:border-white/10 dark:bg-[#0A0E1A] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border"
            >
              {/* Drag handle on mobile only */}
              <div className="w-full flex justify-center pb-4 sm:hidden" onClick={() => setIsAccountModalOpen(false)}>
                <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-outfit">{editingAccount ? 'Edit Account' : 'Add New Account'}</h2>
                <button
                  onClick={() => setIsAccountModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:bg-white/5 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Account Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. City Bank Savings, Cash Wallet"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Wallet Type</label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as any)}
                      className="w-full px-3 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary text-base"
                    >
                      <option value="bank" className="dark:bg-[#0A0E1A]">Bank Account</option>
                      <option value="cash" className="dark:bg-[#0A0E1A]">Cash/Wallet</option>
                      <option value="card" className="dark:bg-[#0A0E1A]">Credit Card</option>
                      <option value="mobile_wallet" className="dark:bg-[#0A0E1A]">Mobile Wallet</option>
                      <option value="other" className="dark:bg-[#0A0E1A]">Other Asset</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Currency</label>
                    <select
                      value={accountCurrency}
                      onChange={(e) => setAccountCurrency(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary text-base"
                    >
                      <option value="BDT" className="dark:bg-[#0A0E1A]">BDT (৳)</option>
                      <option value="USD" className="dark:bg-[#0A0E1A]">USD ($)</option>
                      <option value="EUR" className="dark:bg-[#0A0E1A]">EUR (€)</option>
                      <option value="GBP" className="dark:bg-[#0A0E1A]">GBP (£)</option>
                    </select>
                  </div>
                </div>

                {!editingAccount && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Opening Balance</label>
                    <input
                      type="number"
                      step="any"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base transition-all"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Color Tag</label>
                  <div className="flex gap-3">
                    {['#136dec', '#10b981', '#FFB800', '#FF2A5F', '#8e44ad', '#34495e'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColorTag(c)}
                        className="w-8 h-8 rounded-full border-2 transition-transform active:scale-95 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: c, borderColor: colorTag === c ? '#FFF' : 'transparent' }}
                      >
                        {colorTag === c && <span className="material-symbols-outlined text-[16px] text-white">check</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="flex-1 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    Save Account
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-out Bottom Sheet (Mobile) & Modal Overlay (Desktop) for Transfer Form */}
      <AnimatePresence>
        {isTransferModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTransferModalOpen(false)}
              className="fixed inset-0 bg-slate-950/50 z-50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 w-full rounded-t-[2rem] border-t border-gray-200 bg-white p-6 shadow-2xl z-50 dark:border-white/10 dark:bg-[#0A0E1A] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border"
            >
              <div className="w-full flex justify-center pb-4 sm:hidden" onClick={() => setIsTransferModalOpen(false)}>
                <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-outfit">Transfer Funds</h2>
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:bg-white/5 dark:text-gray-400 dark:hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">From Account (Source)</label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary text-base"
                    required
                  >
                    <option value="" className="dark:bg-[#0A0E1A]">Select Source</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} className="dark:bg-[#0A0E1A]">{a.name} ({a.currency} {a.currentBalance.toFixed(2)})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">To Account (Destination)</label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary text-base"
                    required
                  >
                    <option value="" className="dark:bg-[#0A0E1A]">Select Destination</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} className="dark:bg-[#0A0E1A]">{a.name} ({a.currency} {a.currentBalance.toFixed(2)})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</label>
                    <input
                      type="number"
                      step="any"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
                    <input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Description (Optional)</label>
                  <input
                    type="text"
                    value={transferDesc}
                    onChange={(e) => setTransferDesc(e.target.value)}
                    placeholder="e.g. Monthly transfer to savings"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base transition-all"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="flex-1 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    Transfer Funds
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Toaster position="top-right" richColors />
    </div>
  );
}
