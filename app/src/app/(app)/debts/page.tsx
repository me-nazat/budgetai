'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Debt {
  id: number;
  name: string;
  debtType: 'credit_card' | 'personal_loan' | 'student_loan' | 'bnpl' | 'other';
  balance: number;
  initialBalance: number;
  interestRateApr: number;
  minimumPayment: number;
  dueDayOfMonth: number | null;
  linkedRecurringTransactionId: number | null;
  createdAt: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<any>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/90 text-xs text-gray-900 dark:text-white">
      <p className="font-bold mb-2">{label}</p>
      {payload.map((item, index) => (
        <p key={index} className="font-medium flex items-center gap-2" style={{ color: item.color }}>
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}: {item.value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  );
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const { fmt } = useCurrency();

  // Strategy & Simulation State
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [extraPayment, setExtraPayment] = useState(500);

  // Form State for Modals/Drawers
  const [isOpen, setIsOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  
  const [name, setName] = useState('');
  const [debtType, setDebtType] = useState<'credit_card' | 'personal_loan' | 'student_loan' | 'bnpl' | 'other'>('credit_card');
  const [balance, setBalance] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [interestRateApr, setInterestRateApr] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('');
  const [linkRecurring, setLinkRecurring] = useState(false);

  // Contribution logger state
  const [contribId, setContribId] = useState<number | null>(null);
  const [contribAmt, setContribAmt] = useState('');

  const loadDebts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/debts');
      const data = await res.json();
      setDebts(data.debts || []);
    } catch (err) {
      console.error('Failed to load debts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDebts();
  }, []);

  // Set initial form states
  const openNewForm = () => {
    setEditingDebt(null);
    setName('');
    setDebtType('credit_card');
    setBalance('');
    setInitialBalance('');
    setInterestRateApr('');
    setMinimumPayment('');
    setDueDayOfMonth('');
    setLinkRecurring(true);
    setIsOpen(true);
  };

  const openEditForm = (debt: Debt) => {
    setEditingDebt(debt);
    setName(debt.name);
    setDebtType(debt.debtType);
    setBalance(String(debt.balance));
    setInitialBalance(String(debt.initialBalance));
    setInterestRateApr(String(debt.interestRateApr));
    setMinimumPayment(String(debt.minimumPayment));
    setDueDayOfMonth(debt.dueDayOfMonth ? String(debt.dueDayOfMonth) : '');
    setLinkRecurring(debt.linkedRecurringTransactionId !== null);
    setIsOpen(true);
  };

  // Submit Form
  const saveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance || !interestRateApr || !minimumPayment) return;

    const payload = {
      name,
      debtType,
      balance: parseFloat(balance),
      initialBalance: initialBalance ? parseFloat(initialBalance) : parseFloat(balance),
      interestRateApr: parseFloat(interestRateApr),
      minimumPayment: parseFloat(minimumPayment),
      dueDayOfMonth: dueDayOfMonth ? parseInt(dueDayOfMonth, 10) : null,
      linkRecurring,
    };

    const url = editingDebt ? `/api/debts/${editingDebt.id}` : '/api/debts';
    const method = editingDebt ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsOpen(false);
        await loadDebts();
      }
    } catch (err) {
      console.error('Error saving debt:', err);
    }
  };

  // Delete Debt
  const deleteDebt = async (id: number) => {
    if (!confirm('Are you sure you want to delete this debt?')) return;
    try {
      const res = await fetch(`/api/debts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIsOpen(false);
        await loadDebts();
      }
    } catch (err) {
      console.error('Error deleting debt:', err);
    }
  };

  // Log manual contribution/payment
  const handleLogContribution = async (debt: Debt) => {
    if (!contribAmt) return;
    const payment = parseFloat(contribAmt);
    if (isNaN(payment) || payment <= 0) return;

    const newBalance = Math.max(0, debt.balance - payment);

    try {
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balance: newBalance,
        }),
      });

      if (res.ok) {
        setContribId(null);
        setContribAmt('');
        await loadDebts();
      }
    } catch (err) {
      console.error('Error updating balance:', err);
    }
  };

  // Payoff Simulation logic
  const simulatePayoff = (
    debtsList: Debt[],
    simStrategy: 'snowball' | 'avalanche' | 'baseline',
    extraPay: number
  ) => {
    const list = debtsList.map(d => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      interestRateApr: d.interestRateApr,
      minimumPayment: d.minimumPayment,
    }));

    let month = 0;
    let totalInterest = 0;
    const points: { month: number; balance: number }[] = [];

    const startingTotal = list.reduce((sum, d) => sum + d.balance, 0);
    points.push({ month: 0, balance: Math.round(startingTotal) });

    while (month < 360) {
      let activeDebts = list.filter(d => d.balance > 0);
      if (activeDebts.length === 0) break;
      month++;

      // 1. Accrue Interest
      let interestThisMonth = 0;
      activeDebts.forEach(d => {
        const monthlyRate = (d.interestRateApr / 100) / 12;
        const interest = d.balance * monthlyRate;
        d.balance += interest;
        interestThisMonth += interest;
      });
      totalInterest += interestThisMonth;

      // Filter active debts again in case of accruals
      activeDebts = list.filter(d => d.balance > 0);

      // 2. Pay Minimums
      const minPaymentsNeeded = activeDebts.reduce((sum, d) => {
        return sum + Math.min(d.minimumPayment, d.balance);
      }, 0);

      const actualExtra = simStrategy === 'baseline' ? 0 : extraPay;
      let availablePool = minPaymentsNeeded + actualExtra;

      activeDebts.forEach(d => {
        const payment = Math.min(d.minimumPayment, d.balance);
        d.balance -= payment;
        availablePool -= payment;
      });

      // Clamp negative values and return overflow back to pool
      list.forEach(d => {
        if (d.balance < 0) {
          availablePool += Math.abs(d.balance);
          d.balance = 0;
        }
      });

      // 3. Apply Surplus (Snowball or Avalanche sorting)
      const activeDebtsAfterMin = list.filter(d => d.balance > 0);
      if (activeDebtsAfterMin.length > 0 && availablePool > 0) {
        if (simStrategy === 'avalanche') {
          activeDebtsAfterMin.sort((a, b) => b.interestRateApr - a.interestRateApr);
        } else if (simStrategy === 'snowball') {
          activeDebtsAfterMin.sort((a, b) => a.balance - b.balance);
        }

        for (const targetDebt of activeDebtsAfterMin) {
          if (availablePool <= 0) break;
          const payment = Math.min(availablePool, targetDebt.balance);
          targetDebt.balance -= payment;
          availablePool -= payment;
        }
      }

      const currentTotal = list.reduce((sum, d) => sum + d.balance, 0);
      points.push({ month, balance: Math.round(currentTotal) });

      if (currentTotal <= 0) break;
    }

    return {
      months: month,
      interest: totalInterest,
      points,
    };
  };

  // Compile calculations and charts
  const simulationResults = useMemo(() => {
    if (debts.length === 0) {
      return {
        chartData: [],
        avMonths: 0,
        avInterest: 0,
        sbMonths: 0,
        sbInterest: 0,
        baseMonths: 0,
        baseInterest: 0,
        totalBalance: 0,
        totalMin: 0,
        weightedApr: 0,
      };
    }

    const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
    const totalMin = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
    const totalWeightApr = debts.reduce((sum, d) => sum + (d.balance * d.interestRateApr), 0);
    const weightedApr = totalBalance > 0 ? totalWeightApr / totalBalance : 0;

    const avSim = simulatePayoff(debts, 'avalanche', extraPayment);
    const sbSim = simulatePayoff(debts, 'snowball', extraPayment);
    const baseSim = simulatePayoff(debts, 'baseline', 0);

    const maxMonths = Math.max(avSim.months, sbSim.months, baseSim.months, 1);
    const chartData = [];

    for (let m = 0; m <= maxMonths; m += Math.max(1, Math.round(maxMonths / 30))) {
      const avVal = avSim.points[m] !== undefined ? avSim.points[m].balance : 0;
      const sbVal = sbSim.points[m] !== undefined ? sbSim.points[m].balance : 0;
      const baseVal = baseSim.points[m] !== undefined ? baseSim.points[m].balance : 0;

      chartData.push({
        name: `Month ${m}`,
        'Avalanche': avVal,
        'Snowball': sbVal,
        'Baseline': baseVal,
      });
    }

    // Always ensure the final month (0 balance point) is included
    const lastPointM = maxMonths;
    const avVal = avSim.points[lastPointM] !== undefined ? avSim.points[lastPointM].balance : 0;
    const sbVal = sbSim.points[lastPointM] !== undefined ? sbSim.points[lastPointM].balance : 0;
    const baseVal = baseSim.points[lastPointM] !== undefined ? baseSim.points[lastPointM].balance : 0;
    chartData.push({
      name: `Month ${lastPointM}`,
      'Avalanche': avVal,
      'Snowball': sbVal,
      'Baseline': baseVal,
    });

    return {
      chartData,
      avMonths: avSim.months,
      avInterest: avSim.interest,
      sbMonths: sbSim.months,
      sbInterest: sbSim.interest,
      baseMonths: baseSim.months,
      baseInterest: baseSim.interest,
      totalBalance,
      totalMin,
      weightedApr,
    };
  }, [debts, extraPayment]);

  const selectedSimulationMonths = strategy === 'avalanche' ? simulationResults.avMonths : simulationResults.sbMonths;
  const interestSaved = Math.max(0, simulationResults.baseInterest - (strategy === 'avalanche' ? simulationResults.avInterest : simulationResults.sbInterest));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-bg-dark text-gray-900 dark:text-white px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Title */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Debt Payoff Planner</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
              Visualize payoff trajectories and compare Snowball vs Avalanche strategy speeds.
            </p>
          </div>
          <button
            onClick={openNewForm}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all active:scale-[0.98] sm:self-start"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Add Liability
          </button>
        </div>

        {loading && debts.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Debts Ledger */}
            <div className="lg:col-span-2 space-y-6">
              {debts.length === 0 ? (
                <div className="glass-panel text-center py-16 px-6 rounded-3xl border border-gray-150 dark:border-white/5">
                  <span className="material-symbols-outlined text-gray-400 text-5xl mb-4">payments</span>
                  <h3 className="text-lg font-black">No debts added yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-md mx-auto">
                    Add your credit cards, loans, or other liabilities to model a payment payoff acceleration plan.
                  </p>
                  <button
                    onClick={openNewForm}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:bg-primary/90"
                  >
                    Add First Liability
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {debts.map(debt => {
                    const pctRemaining = Math.max(0, Math.min(100, Math.round((debt.balance / debt.initialBalance) * 100)));
                    const isPaid = debt.balance === 0;

                    return (
                      <div
                        key={debt.id}
                        className={`glass-panel relative overflow-hidden rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg border ${
                          isPaid
                            ? 'border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-bg-dark shadow-[0_0_30px_rgba(16,185,129,0.1)]'
                            : 'border-gray-100 dark:border-white/5 hover:border-primary/20'
                        }`}
                      >
                        <div className="absolute right-0 bottom-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02]">
                          <span className="material-symbols-outlined text-[130px] -mr-8 -mb-8">
                            {isPaid ? 'verified' : 'credit_card'}
                          </span>
                        </div>

                        <div className="relative mb-4 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                                isPaid
                                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                  : 'bg-primary/10 text-primary border border-primary/20'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {isPaid ? 'check_circle' : 'account_balance'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-black text-gray-900 dark:text-white truncate leading-tight">
                                {debt.name}
                              </h3>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                                {debt.debtType.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEditForm(debt)}
                              className="grid h-7 w-7 place-items-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                            <button
                              onClick={() => void deleteDebt(debt.id)}
                              className="grid h-7 w-7 place-items-center rounded-full bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:bg-white/5 dark:hover:bg-rose-500/25 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
                        </div>

                        <div className="relative mb-4 flex items-end justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                              Remaining Balance
                            </span>
                            <p className={`text-2xl font-black ${isPaid ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
                              {fmt(debt.balance)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">
                              Initial
                            </span>
                            <p className="text-sm font-bold text-gray-500">{fmt(debt.initialBalance)}</p>
                          </div>
                        </div>

                        <div className="relative mb-4 grid grid-cols-2 gap-3 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl text-xs font-semibold">
                          <div>
                            <span className="text-gray-400 block text-[9px] uppercase tracking-wider mb-0.5">APR</span>
                            <span className="text-gray-900 dark:text-white font-bold">{debt.interestRateApr}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-400 block text-[9px] uppercase tracking-wider mb-0.5">Min. Payment</span>
                            <span className="text-gray-900 dark:text-white font-bold">{fmt(debt.minimumPayment)}</span>
                          </div>
                        </div>

                        <div className="relative flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-3.5 mt-3">
                          <div className="text-[10px] font-bold text-gray-500">
                            {debt.dueDayOfMonth ? `Due Day ${debt.dueDayOfMonth} of Month` : 'No specific due day'}
                          </div>
                          
                          {isPaid ? (
                            <div className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                              <span className="material-symbols-outlined text-[16px]">celebration</span>
                              Debt Paid Off
                            </div>
                          ) : (
                            <div 
                              className="relative w-[38px] h-[38px] rounded-full flex items-center justify-center shrink-0" 
                              style={{ 
                                background: `conic-gradient(#ef4444 ${pctRemaining}%, rgba(16,185,129,0.2) ${pctRemaining}%)` 
                              }}
                            >
                              <div className="absolute inset-[2.5px] bg-white dark:bg-[#151926] rounded-full flex items-center justify-center">
                                <span className="text-[9px] font-black text-rose-500">{pctRemaining}%</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {!isPaid && (
                          <div className="mt-4">
                            {contribId === debt.id ? (
                              <div className="flex gap-2 bg-gray-50 dark:bg-white/5 p-2 rounded-2xl border border-gray-250 dark:border-white/10">
                                <input
                                  type="number"
                                  value={contribAmt}
                                  onChange={e => setContribAmt(e.target.value)}
                                  placeholder="Log payment"
                                  className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-900 outline-none dark:bg-bg-dark dark:text-white transition-all shadow-inner border border-gray-250 dark:border-white/10"
                                />
                                <button
                                  onClick={() => void handleLogContribution(debt)}
                                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-white hover:bg-emerald-600 active:scale-95 transition-all"
                                >
                                  Log
                                </button>
                                <button
                                  onClick={() => { setContribId(null); setContribAmt(''); }}
                                  className="grid w-8 place-items-center rounded-xl bg-white text-gray-400 hover:text-gray-900 dark:bg-bg-dark dark:hover:text-white shadow-inner"
                                >
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setContribId(debt.id)}
                                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-xs font-bold text-gray-600 hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-primary/10 transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                Log Contribution
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Payoff Simulation Chart */}
              {debts.length > 0 && (
                <div className="card-premium rounded-3xl p-5 lg:p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      timeline
                    </span>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Payoff Trajectory Forecast</h3>
                  </div>

                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={simulationResults.chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="avalancheGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#136dec" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#136dec" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="snowballGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 9, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="Avalanche" stroke="#136dec" strokeWidth={2} fill="url(#avalancheGrad)" />
                        <Area type="monotone" dataKey="Snowball" stroke="#f59e0b" strokeWidth={2} fill="url(#snowballGrad)" />
                        <Area type="monotone" dataKey="Baseline" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#baselineGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Payoff Acceleration Panel */}
            <div className="space-y-6">
              {/* Quick Stats Panel */}
              <div className="glass-panel rounded-3xl p-6 border border-gray-150 dark:border-white/5 space-y-5">
                <h3 className="text-md font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
                  Liability Ledger Summary
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-100 dark:border-white/5">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Outstanding</span>
                    <span className="text-xl font-black text-rose-500">{fmt(simulationResults.totalBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-100 dark:border-white/5">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Weighted APR</span>
                    <span className="text-sm font-black">{simulationResults.weightedApr.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-gray-100 dark:border-white/5">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Monthly Min Payment</span>
                    <span className="text-sm font-black">{fmt(simulationResults.totalMin)}</span>
                  </div>
                </div>
              </div>

              {/* strategy details & controls */}
              {debts.length > 0 && (
                <div className="glass-panel rounded-3xl p-6 border border-gray-150 dark:border-white/5 space-y-6">
                  <div>
                    <h3 className="text-md font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
                      Payoff Accelerator
                    </h3>
                    <p className="text-xs font-medium text-gray-500">
                      Customize strategy and extra monthly payments to see your interest savings.
                    </p>
                  </div>

                  {/* Strategy Selector */}
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                      Acceleration Method
                    </span>
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-white/5 p-1 rounded-2xl">
                      <button
                        onClick={() => setStrategy('avalanche')}
                        className={`py-3 text-xs font-black rounded-xl transition-all ${
                          strategy === 'avalanche'
                            ? 'bg-white dark:bg-bg-dark text-primary shadow-md shadow-slate-900/5'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                      >
                        Avalanche (APR)
                      </button>
                      <button
                        onClick={() => setStrategy('snowball')}
                        className={`py-3 text-xs font-black rounded-xl transition-all ${
                          strategy === 'snowball'
                            ? 'bg-white dark:bg-bg-dark text-amber-500 shadow-md shadow-slate-900/5'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                      >
                        Snowball (Balance)
                      </button>
                    </div>
                  </div>

                  {/* Extra Payment Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Extra Monthly Payment
                      </span>
                      <span className="text-sm font-black text-primary">{fmt(extraPayment)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10000}
                      step={100}
                      value={extraPayment}
                      onChange={e => setExtraPayment(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[9px] font-black text-gray-400 mt-1 uppercase tracking-wider">
                      <span>Min ({fmt(0)})</span>
                      <span>Max ({fmt(10000)})</span>
                    </div>
                  </div>

                  {/* Results summary stats */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-3.5 border border-gray-100 dark:border-white/5 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Months to Debt Free</p>
                      <p className="text-xl font-black text-primary">{selectedSimulationMonths} months</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-3.5 border border-emerald-100/50 dark:border-emerald-500/10 text-center">
                      <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Interest Saved</p>
                      <p className="text-xl font-black text-emerald-500">{fmt(interestSaved)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DRAWERS/MODALS FOR ADD & EDIT */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center p-0 lg:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Wrapper (Mobile) & Modal Card (Desktop) */}
          <div className="relative w-full max-h-[90vh] lg:max-w-lg overflow-y-auto rounded-t-[2.5rem] lg:rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl backdrop-blur-xl transition-all dark:border-white/10 dark:bg-[#0A0D18]/95 flex flex-col">
            {/* Drag Handle (Mobile only) */}
            <div className="lg:hidden w-full flex justify-center pb-5 shrink-0" onClick={() => setIsOpen(false)}>
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">
                {editingDebt ? 'Edit Liability' : 'Add Liability'}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={saveDebt} className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Visa Credit Card"
                  className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Debt Type
                  </label>
                  <select
                    value={debtType}
                    onChange={e => setDebtType(e.target.value as any)}
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="personal_loan">Personal Loan</option>
                    <option value="student_loan">Student Loan</option>
                    <option value="bnpl">Buy Now Pay Later (BNPL)</option>
                    <option value="other">Other Liability</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Interest Rate (APR %)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={interestRateApr}
                    onChange={e => setInterestRateApr(e.target.value)}
                    placeholder="e.g. 19.99"
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Current Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Initial Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={initialBalance}
                    onChange={e => setInitialBalance(e.target.value)}
                    placeholder="Optional (Defaults to current)"
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Minimum Payment
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={minimumPayment}
                    onChange={e => setMinimumPayment(e.target.value)}
                    placeholder="e.g. 150"
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Due Day of Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDayOfMonth}
                    onChange={e => setDueDayOfMonth(e.target.value)}
                    placeholder="e.g. 15 (Optional)"
                    className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="linkRecurring"
                  checked={linkRecurring}
                  onChange={e => setLinkRecurring(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4.5 w-4.5"
                />
                <label htmlFor="linkRecurring" className="text-xs font-bold text-gray-600 dark:text-gray-300">
                  Automatically link and post to Recurring Payments calendar
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-2xl border border-gray-200 dark:border-white/10 py-3.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-black text-white hover:bg-primary/95 transition-all shadow-lg shadow-primary/25"
                >
                  {editingDebt ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
