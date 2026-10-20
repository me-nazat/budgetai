/**
 * @fileoverview Net worth service — business logic for net worth tracking, asset-liability breakdown, and hybrid backfill progression.
 *
 * @module services/networth.service
 */

import { db } from '@/db/client';
import { NetWorthRepository } from '@/repositories/networth.repository';
import { AuditService } from '@/services/audit.service';
import { validateInput } from '@/lib/types/api';
import { CreateNetWorthDTO, type NetWorthResponseDTO } from '@/lib/types/dto';
import { NotFoundError } from '@/lib/types/errors';
import { accounts, debts, investmentHoldings, netWorth, transactions } from '@/db/schema';
import { eq, and, or, isNull, sql, desc, gte } from 'drizzle-orm';

import { getTourReceivablesAndPayables } from '@/lib/tour-sync';
import { getHouseholdReceivablesAndPayables } from '@/lib/household-sync';

export interface NetWorthBreakdownItem {
  name: string;
  amount: number;
  share: number;
  color?: string;
  icon?: string;
}

export interface NetWorthCategoryBreakdown {
  liquidCash: number;
  investments: number;
  realEstate: number;
  physicalAssets: number;
  totalAssets: number;
  creditCards: number;
  loans: number;
  mortgages: number;
  totalLiabilities: number;
  netWorth: number;
  debtToAssetRatio: number;
  netCollaborativeReceivables?: number;
  netCollaborativePayables?: number;
  assetsList: NetWorthBreakdownItem[];
  liabilitiesList: NetWorthBreakdownItem[];
}

export interface HistoricalNetWorthPoint {
  date: string;
  label: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

export interface NetWorthComprehensiveResponse {
  entries: NetWorthResponseDTO[];
  currentBreakdown: NetWorthCategoryBreakdown;
  history: {
    oneYear: HistoricalNetWorthPoint[];
    threeYear: HistoricalNetWorthPoint[];
    fiveYear: HistoricalNetWorthPoint[];
  };
}

export class NetWorthService {
  /**
   * Retrieves all net worth entries for a user.
   */
  static async getAll(userId: number): Promise<NetWorthResponseDTO[]> {
    const records = await NetWorthRepository.findAll(userId);

    return records.map((r) => ({
      id: r.id,
      amount: r.amount,
      note: r.note || '',
      createdAt: r.createdAt ?? undefined,
    }));
  }

  /**
   * Creates a new net worth snapshot.
   */
  static async create(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<NetWorthResponseDTO> {
    const validated = validateInput(CreateNetWorthDTO, data);

    const record = await NetWorthRepository.create({
      userId,
      amount: validated.amount,
      note: validated.note,
    });

    AuditService.logCreate(
      userId,
      'networth',
      record.id,
      { amount: validated.amount },
      ctx.ip,
      ctx.userAgent
    );

    return {
      id: record.id,
      amount: record.amount,
      note: record.note || '',
      createdAt: record.createdAt ?? undefined,
    };
  }

  /**
   * Deletes a net worth entry.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const deleted = await NetWorthRepository.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError('Net worth entry not found');
    }

    AuditService.logDelete(
      userId,
      'networth',
      id,
      { amount: deleted.amount },
      ctx.ip,
      ctx.userAgent
    );
  }

  /**
   * Calculates comprehensive Net Worth breakdown and multi-horizon historical progression.
   * Uses Hybrid Backfill: Merges actual recorded snapshots with backward-reconstructed ledger deltas.
   */
  static async getNetWorthBreakdown(userId: number): Promise<NetWorthComprehensiveResponse> {
    // 1. Fetch user accounts
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, 0)));

    let liquidCash = 0;
    let otherAccountAssets = 0;

    userAccounts.forEach((acc) => {
      const bal = Number(acc.currentBalance) || 0;
      if (acc.type === 'cash' || acc.type === 'bank' || acc.type === 'mobile_wallet') {
        liquidCash += bal;
      } else if (acc.type === 'other') {
        otherAccountAssets += Math.max(0, bal);
      }
    });

    // 2. Fetch investment holdings
    const holdings = await db
      .select()
      .from(investmentHoldings)
      .where(eq(investmentHoldings.userId, userId));

    const totalInvestments = holdings.reduce((sum, h) => {
      const q = Number(h.quantity) || 0;
      const basis = Number(h.avgCostBasis) || 0;
      return sum + q * basis;
    }, 0) + otherAccountAssets;

    // 3. Fetch snapshots to check for property/real estate valuations
    const snapshots = await NetWorthRepository.findAll(userId);
    let realEstate = 0;
    let physicalAssets = 0;

    snapshots.forEach((s) => {
      const noteLower = (s.note || '').toLowerCase();
      if (noteLower.includes('property') || noteLower.includes('real estate') || noteLower.includes('house') || noteLower.includes('land')) {
        realEstate = Math.max(realEstate, s.amount);
      } else if (noteLower.includes('vehicle') || noteLower.includes('car') || noteLower.includes('gold') || noteLower.includes('valuable')) {
        physicalAssets = Math.max(physicalAssets, s.amount);
      }
    });

    // 4. Fetch user debts (liabilities) and collaborative positions
    const [userDebts, tourCollab, hhCollab] = await Promise.all([
      db.select().from(debts).where(eq(debts.userId, userId)),
      getTourReceivablesAndPayables(userId).catch(() => ({ receivables: 0, payables: 0 })),
      getHouseholdReceivablesAndPayables(userId).catch(() => ({ receivables: 0, payables: 0 })),
    ]);

    const netCollaborativeReceivables = Math.round(((tourCollab?.receivables || 0) + (hhCollab?.receivables || 0)) * 100) / 100;
    const netCollaborativePayables = Math.round(((tourCollab?.payables || 0) + (hhCollab?.payables || 0)) * 100) / 100;

    let creditCards = 0;
    let loans = 0;
    let mortgages = 0;

    userDebts.forEach((d) => {
      const bal = Math.max(0, Number(d.balance) || 0);
      const nameLower = d.name.toLowerCase();
      if (d.debtType === 'credit_card') {
        creditCards += bal;
      } else if (d.debtType === 'personal_loan' || d.debtType === 'student_loan' || d.debtType === 'bnpl') {
        loans += bal;
      } else if (d.debtType === 'other' && (nameLower.includes('mortgage') || nameLower.includes('home'))) {
        mortgages += bal;
      } else {
        loans += bal;
      }
    });

    const totalAssets = Math.max(0, liquidCash + totalInvestments + realEstate + physicalAssets + netCollaborativeReceivables);
    const totalLiabilities = Math.max(0, creditCards + loans + mortgages + netCollaborativePayables);
    const netWorthValue = totalAssets - totalLiabilities;
    const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

    // Build items lists
    const assetsList: NetWorthBreakdownItem[] = [
      {
        name: 'Liquid Cash & Savings',
        amount: liquidCash,
        share: totalAssets > 0 ? (liquidCash / totalAssets) * 100 : 0,
        color: '#10B981',
        icon: 'account_balance_wallet',
      },
      {
        name: 'Investments & Holdings',
        amount: totalInvestments,
        share: totalAssets > 0 ? (totalInvestments / totalAssets) * 100 : 0,
        color: '#4F46E5',
        icon: 'trending_up',
      },
      {
        name: 'Real Estate & Property',
        amount: realEstate,
        share: totalAssets > 0 ? (realEstate / totalAssets) * 100 : 0,
        color: '#0284C7',
        icon: 'apartment',
      },
      {
        name: 'Physical Assets & Valuables',
        amount: physicalAssets,
        share: totalAssets > 0 ? (physicalAssets / totalAssets) * 100 : 0,
        color: '#F59E0B',
        icon: 'diamond',
      },
      ...(netCollaborativeReceivables > 0
        ? [
            {
              name: 'Group Receivables (Owed by Others)',
              amount: netCollaborativeReceivables,
              share: totalAssets > 0 ? (netCollaborativeReceivables / totalAssets) * 100 : 0,
              color: '#06B6D4',
              icon: 'handshake',
            },
          ]
        : []),
    ].filter((item) => item.amount > 0 || item.name.includes('Liquid Cash'));

    const liabilitiesList: NetWorthBreakdownItem[] = [
      {
        name: 'Credit Cards',
        amount: creditCards,
        share: totalLiabilities > 0 ? (creditCards / totalLiabilities) * 100 : 0,
        color: '#F43F5E',
        icon: 'credit_card',
      },
      {
        name: 'Personal & Student Loans',
        amount: loans,
        share: totalLiabilities > 0 ? (loans / totalLiabilities) * 100 : 0,
        color: '#FB923C',
        icon: 'payments',
      },
      {
        name: 'Mortgages & Home Loans',
        amount: mortgages,
        share: totalLiabilities > 0 ? (mortgages / totalLiabilities) * 100 : 0,
        color: '#E11D48',
        icon: 'home',
      },
      ...(netCollaborativePayables > 0
        ? [
            {
              name: 'Group Payables (Owed to Others)',
              amount: netCollaborativePayables,
              share: totalLiabilities > 0 ? (netCollaborativePayables / totalLiabilities) * 100 : 0,
              color: '#BE123C',
              icon: 'money_off',
            },
          ]
        : []),
    ].filter((item) => item.amount > 0 || item.name.includes('Credit Cards'));

    // 5. Hybrid Backfill for Historical Progression
    // Query historical monthly transaction net deltas (earnings - expenses)
    const monthlyLedger = await db
      .select({
        monthStr: sql<string>`strftime('%Y-%m', ${transactions.date})`,
        type: transactions.type,
        total: sql<number>`SUM(COALESCE(${transactions.personalShareAmount}, ${transactions.amount}))`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          or(eq(transactions.isSettlementTransfer, 0), isNull(transactions.isSettlementTransfer))
        )
      )
      .groupBy(sql`strftime('%Y-%m', ${transactions.date})`, transactions.type);

    const monthlyDeltas = new Map<string, number>();
    monthlyLedger.forEach((row) => {
      const current = monthlyDeltas.get(row.monthStr) || 0;
      if (row.type === 'earning') {
        monthlyDeltas.set(row.monthStr, current + Number(row.total));
      } else if (row.type === 'expense') {
        monthlyDeltas.set(row.monthStr, current - Number(row.total));
      }
    });

    const snapshotMap = new Map<string, number>();
    snapshots.forEach((s) => {
      if (s.createdAt) {
        const monthKey = s.createdAt.slice(0, 7);
        snapshotMap.set(monthKey, s.amount);
      }
    });

    // Generator function for backward-synthesized timeline
    const generateHistoricalSeries = (monthsBack: number): HistoricalNetWorthPoint[] => {
      const points: HistoricalNetWorthPoint[] = [];
      const now = new Date();

      let runningAssets = totalAssets;
      let runningLiabilities = totalLiabilities;

      for (let i = 0; i < monthsBack; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const monthKey = `${y}-${m}`;
        const label = targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

        if (i > 0) {
          // Adjust running assets backwards by subtracting subsequent month's net savings
          const subsequentMonthDate = new Date(now.getFullYear(), now.getMonth() - (i - 1), 1);
          const subKey = `${subsequentMonthDate.getFullYear()}-${String(subsequentMonthDate.getMonth() + 1).padStart(2, '0')}`;
          const netSaved = monthlyDeltas.get(subKey) || 0;

          runningAssets = Math.max(0, runningAssets - netSaved * 0.85); // 85% flow factor to asset growth
          // Liability reduction model: estimated 1% principal amortization per month backwards
          runningLiabilities = Math.min(totalLiabilities * 1.5, runningLiabilities * 1.01);
        }

        let computedNetWorth = runningAssets - runningLiabilities;

        // Overlay actual snapshot if present
        if (snapshotMap.has(monthKey)) {
          computedNetWorth = snapshotMap.get(monthKey)!;
        }

        points.unshift({
          date: monthKey,
          label,
          netWorth: Math.round(computedNetWorth),
          assets: Math.round(runningAssets),
          liabilities: Math.round(runningLiabilities),
        });
      }

      return points;
    };

    const oneYear = generateHistoricalSeries(12);
    const threeYear = generateHistoricalSeries(36);
    const fiveYear = generateHistoricalSeries(60);

    const formattedEntries: NetWorthResponseDTO[] = snapshots.map((s) => ({
      id: s.id,
      amount: s.amount,
      note: s.note || '',
      createdAt: s.createdAt ?? undefined,
    }));

    return {
      entries: formattedEntries,
      currentBreakdown: {
        liquidCash: Math.round(liquidCash),
        investments: Math.round(totalInvestments),
        realEstate: Math.round(realEstate),
        physicalAssets: Math.round(physicalAssets),
        totalAssets: Math.round(totalAssets),
        creditCards: Math.round(creditCards),
        loans: Math.round(loans),
        mortgages: Math.round(mortgages),
        totalLiabilities: Math.round(totalLiabilities),
        netWorth: Math.round(netWorthValue),
        debtToAssetRatio: Math.round(debtToAssetRatio * 10) / 10,
        netCollaborativeReceivables: Math.round(netCollaborativeReceivables),
        netCollaborativePayables: Math.round(netCollaborativePayables),
        assetsList,
        liabilitiesList,
      },
      history: {
        oneYear,
        threeYear,
        fiveYear,
      },
    };
  }
}
