import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { CreateTourSchema, TourIdParamSchema, TourTransactionSchema } from '@/lib/validation';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { TransactionRepository } from '@/repositories/transaction.repository';
import {
  calculateTourKitty,
  syncTourSpendingToPersonalLedger,
  deleteTourSpendingPersonalLedger,
  recordTourSettlementTransfer,
  broadcastTourUpdate,
} from '@/lib/tour-sync';
import {
  allocatePennyShares,
  calculateMinSettlements,
  type BalanceNode,
} from '@/lib/algorithms/minSettlement';

type RouteContextWithId = {
  params?: Promise<{ id: string }> | { id: string };
};

type DbRow = Record<string, unknown>;

export interface TourParticipantResponse {
  id: number;
  tourId: number;
  name: string;
  userId: number | null;
}

export interface TourTransactionResponse {
  id: number;
  amount: number;
  baseAmount?: number;
  category: string;
  description: string;
  date: string;
  tourId: number;
  paidBy: number;
  paidByParticipantId: number;
  paidByName: string | null;
  recipientMemberId?: number | null;
  recipientName?: string | null;
  entryType?: 'expense' | 'deposit' | 'settlement';
  fundingSource?: 'member_direct' | 'tour_pool';
  currency?: string;
  exchangeRateToTourBase?: number;
  linkedAccountId?: number | null;
  linkedTransactionId?: number | null;
  splitBreakdown?: any[];
  createdById?: number | null;
  createdByName?: string | null;
  splitType: 'equal' | 'percentage' | 'exact' | 'shares';
  createdAt: string | null;
}
interface TourParticipantWithBalance extends TourParticipantResponse {
  paid: number;
  balance: number;
}

interface TourMetrics {
  totalSpent: number;
  transactionCount: number;
  averageCost: number;
}

interface TourResponse {
  id: number;
  name: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  baseCurrency?: string;
  totalBudget?: number;
  inviteCode?: string | null;
  status?: string;
  createdAt: string | null;
  createdBy: number;
  participants: TourParticipantResponse[] | TourParticipantWithBalance[];
  transactions?: TourTransactionResponse[];
  totalSpent: number;
  perPerson: number;
  averageCost: number;
  transactionCount: number;
  balances?: TourParticipantWithBalance[];
}

function toNumber(value: unknown, fallback = 0): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseSplitBreakdown(json: unknown): any[] {
  if (typeof json !== 'string' || !json.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeParticipant(row: DbRow): TourParticipantResponse {
  return {
    id: toNumber(row.id),
    tourId: toNumber(row.tour_id ?? row.tourId),
    name: String(row.name ?? ''),
    userId: toNullableNumber(row.user_id ?? row.userId),
  };
}

function normalizeTransaction(row: DbRow): TourTransactionResponse {
  const paidBy = toNumber(row.paidBy ?? row.paid_by_participant_id ?? row.paid_by);
  const amount = toNumber(row.amount);
  const rate = toNumber(row.exchange_rate_to_tour_base ?? row.exchangeRateToTourBase, 1.0);

  return {
    id: toNumber(row.id),
    amount,
    baseAmount: Math.round(amount * rate * 100) / 100,
    category: String(row.category ?? 'Travel'),
    description: String(row.description ?? ''),
    date: String(row.date ?? ''),
    tourId: toNumber(row.tour_id ?? row.tourId),
    paidBy,
    paidByParticipantId: paidBy,
    paidByName: row.paid_by_name ? String(row.paid_by_name) : null,
    recipientMemberId: toNullableNumber(row.recipient_member_id ?? row.recipientMemberId),
    recipientName: row.recipient_name ? String(row.recipient_name) : null,
    entryType: (row.entry_type ?? row.entryType ?? 'expense') as TourTransactionResponse['entryType'],
    fundingSource: (row.funding_source ?? row.fundingSource ?? 'member_direct') as TourTransactionResponse['fundingSource'],
    currency: String(row.currency ?? 'BDT'),
    exchangeRateToTourBase: rate,
    linkedAccountId: toNullableNumber(row.linked_account_id ?? row.linkedAccountId),
    linkedTransactionId: toNullableNumber(row.linked_transaction_id ?? row.linkedTransactionId),
    splitBreakdown: parseSplitBreakdown(row.split_breakdown_json ?? row.splitBreakdownJson),
    createdById: toNullableNumber(row.created_by_user_id),
    createdByName: row.created_by_name ? String(row.created_by_name) : null,
    splitType: (row.split_type ?? row.splitType ?? 'equal') as TourTransactionResponse['splitType'],
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

function normalizeTour(
  row: DbRow, 
  participants: TourParticipantResponse[], 
  metrics: TourMetrics,
  balances: TourParticipantWithBalance[],
  transactions?: TourTransactionResponse[]
): TourResponse {
  const perPerson = participants.length > 0 ? metrics.totalSpent / participants.length : 0;
  
  return {
    id: toNumber(row.id),
    name: String(row.name ?? ''),
    destination: row.destination ? String(row.destination) : null,
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    baseCurrency: row.base_currency ? String(row.base_currency) : 'BDT',
    totalBudget: toNumber(row.total_budget),
    inviteCode: row.invite_code ? String(row.invite_code) : null,
    status: row.status ? String(row.status) : 'active',
    createdAt: row.created_at ? String(row.created_at) : null,
    createdBy: toNumber(row.created_by ?? row.user_id),
    participants,
    totalSpent: metrics.totalSpent,
    perPerson,
    averageCost: metrics.averageCost,
    transactionCount: metrics.transactionCount,
    balances,
    ...(transactions ? { transactions } : {}),
  };
}

async function resolveTourId(routeContext?: RouteContextWithId): Promise<number> {
  const params = await routeContext?.params;
  return TourIdParamSchema.parse({ id: params?.id }).id;
}

async function getParticipants(tourId: number): Promise<TourParticipantResponse[]> {
  const rows = await queryAll<DbRow>(
    `SELECT id, tour_id, name, user_id
     FROM tour_participants
     WHERE tour_id = ?
     ORDER BY id ASC`,
    [tourId]
  );

  return rows.map(normalizeParticipant);
}

async function getTourTransactions(userId: number, tourId: number): Promise<TourTransactionResponse[]> {
  const rows = await queryAll<DbRow>(
    `SELECT
       t.id,
       t.amount,
       t.category,
       t.description,
       t.date,
       t.tour_id,
       t.paid_by_participant_id AS paidBy,
       t.paid_by_participant_id,
       t.paid_by_participant_id AS paid_by,
       t.split_type,
       t.created_at,
       t.created_by_user_id,
       p.name AS paid_by_name,
       u.name AS created_by_name
     FROM tour_spendings t
     LEFT JOIN tour_participants p
       ON p.id = t.paid_by_participant_id
     LEFT JOIN users u
       ON u.id = t.created_by_user_id
     WHERE t.tour_id = ?
     ORDER BY t.date DESC, t.created_at DESC, t.id DESC`,
    [tourId]
  );

  return rows.map(normalizeTransaction);
}

async function getTourMetrics(tourId: number): Promise<TourMetrics> {
  const row = await queryOne<{ total: number; count: number; avg: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total,
            COUNT(id) AS count,
            COALESCE(AVG(amount), 0) AS avg
     FROM tour_spendings
     WHERE tour_id = ?`,
    [tourId]
  );

  return {
    totalSpent: toNumber(row?.total),
    transactionCount: toNumber(row?.count),
    averageCost: toNumber(row?.avg),
  };
}

async function getTourBalances(tourId: number, participants: TourParticipantResponse[], totalSpent: number): Promise<TourParticipantWithBalance[]> {
  const rows = await queryAll<{ participant_id: number; paid: number }>(
    `SELECT paid_by_participant_id as participant_id, COALESCE(SUM(amount), 0) as paid
     FROM tour_spendings
     WHERE tour_id = ?
     GROUP BY paid_by_participant_id`,
    [tourId]
  );
  
  const paidMap = new Map(rows.map(r => [r.participant_id, toNumber(r.paid)]));
  const perPerson = participants.length > 0 ? totalSpent / participants.length : 0;
  
  return participants.map(p => {
    const paid = paidMap.get(p.id) ?? 0;
    return { ...p, paid, balance: paid - perPerson };
  });
}

async function getTourPayload(
  userId: number,
  tourId: number,
  includeTransactions = false
): Promise<TourResponse | null> {
  // Allow access if user is the creator OR a bound participant
  const tour = await queryOne<DbRow>(
    `SELECT DISTINCT t.id, t.created_by, t.name, t.destination, t.start_date, t.end_date, t.base_currency, t.total_budget, t.status, t.created_at, t.invite_code
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, userId, userId]
  );

  if (!tour) return null;

  const [participants, metrics, transactions] = await Promise.all([
    getParticipants(tourId),
    getTourMetrics(tourId),
    includeTransactions ? getTourTransactions(userId, tourId) : Promise.resolve(undefined),
  ]);

  const balances = await getTourBalances(tourId, participants, metrics.totalSpent);

  return normalizeTour(tour, participants, metrics, balances, transactions);
}

export async function listTours(_request: NextRequest, userId: number) {
  // Show tours where user is creator OR a bound participant
  const tours = await queryAll<DbRow>(
    `SELECT DISTINCT t.id, t.created_by, t.name, t.destination, t.start_date, t.end_date, t.base_currency, t.total_budget, t.status, t.created_at, t.invite_code
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.created_by = ? OR tp.user_id = ?
     ORDER BY datetime(t.created_at) DESC, t.id DESC`,
    [userId, userId]
  );

  const hydratedTours = await Promise.all(
    tours.map(async (tour) => {
      const tourId = toNumber(tour.id);
      const [participants, metrics] = await Promise.all([
        getParticipants(tourId),
        getTourMetrics(tourId),
      ]);

      const balances = await getTourBalances(tourId, participants, metrics.totalSpent);

      return normalizeTour(tour, participants, metrics, balances);
    })
  );

  return NextResponse.json({ success: true, tours: hydratedTours });
}

export async function createTour(request: NextRequest, userId: number) {
  const body = await request.json();
  const data = CreateTourSchema.parse(body);
  let tourId: number | null = null;

  try {
    const result = await run(
      `INSERT INTO tours (
         created_by, name, destination, start_date, end_date, base_currency, total_budget
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.name,
        data.destination || null,
        data.startDate || null,
        data.endDate || null,
        data.baseCurrency || 'BDT',
        data.totalBudget || 0,
      ]
    );
    tourId = result.lastInsertRowid;

    await run(
      `INSERT OR IGNORE INTO tour_groups (id, user_id, name, created_at)
       SELECT id, created_by, name, created_at
       FROM tours
       WHERE id = ?`,
      [tourId]
    );

    for (const participant of data.participants) {
      await run(
        'INSERT INTO tour_participants (tour_id, name) VALUES (?, ?)',
        [tourId, participant]
      );
    }

    const tour = await getTourPayload(userId, tourId, true);
    return NextResponse.json({ success: true, tour }, { status: 201 });
  } catch (error) {
    if (tourId) {
      await run('DELETE FROM tour_participants WHERE tour_id = ?', [tourId]).catch(() => undefined);
      await run('DELETE FROM tours WHERE id = ? AND created_by = ?', [tourId, userId]).catch(() => undefined);
      await run('DELETE FROM tour_groups WHERE id = ? AND user_id = ?', [tourId, userId]).catch(() => undefined);
    }
    throw error;
  }
}

async function getTourWorkspace(userId: number, tourId: number) {
  const tour = await queryOne<DbRow>(
    `SELECT DISTINCT t.id, t.created_by, t.name, t.destination, t.start_date, t.end_date,
            t.base_currency, t.total_budget, t.invite_code, t.status, t.created_at
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, userId, userId]
  );

  if (!tour) return null;

  const [participants, metrics, rawSpendings, kittySummary] = await Promise.all([
    getParticipants(tourId),
    getTourMetrics(tourId),
    queryAll<DbRow>(
      `SELECT s.*, p.name AS paid_by_name, r.name AS recipient_name, u.name AS created_by_name
       FROM tour_spendings s
       LEFT JOIN tour_participants p ON p.id = s.paid_by_participant_id
       LEFT JOIN tour_participants r ON r.id = s.recipient_member_id
       LEFT JOIN users u ON u.id = s.created_by_user_id
       WHERE s.tour_id = ?
       ORDER BY s.date DESC, s.created_at DESC, s.id DESC`,
      [tourId]
    ),
    calculateTourKitty(tourId),
  ]);

  const pMap = new Map(participants.map((p) => [p.id, p]));

  const memberStats = new Map<number, {
    totalPaidOutOfPocket: number;
    totalDepositedToKitty: number;
    totalConsumedShare: number;
    totalSettledPaid: number;
    totalSettledReceived: number;
  }>();

  for (const p of participants) {
    memberStats.set(p.id, {
      totalPaidOutOfPocket: 0,
      totalDepositedToKitty: 0,
      totalConsumedShare: 0,
      totalSettledPaid: 0,
      totalSettledReceived: 0,
    });
  }

  const detailedSpendings = rawSpendings.map((row) => {
    const amount = toNumber(row.amount);
    const rate = toNumber(row.exchange_rate_to_tour_base, 1.0);
    const baseAmount = Math.round(amount * rate * 100) / 100;
    const payerId = toNumber(row.paid_by_participant_id);
    const recipientId = toNullableNumber(row.recipient_member_id);
    const entryType = (row.entry_type || 'expense') as 'expense' | 'deposit' | 'settlement';
    const fundingSource = (row.funding_source || 'member_direct') as 'member_direct' | 'tour_pool';
    const splitBreakdown = parseSplitBreakdown(row.split_breakdown_json);

    const payerStats = memberStats.get(payerId);
    if (payerStats) {
      if (entryType === 'deposit') {
        payerStats.totalDepositedToKitty += baseAmount;
      } else if (entryType === 'settlement') {
        payerStats.totalSettledPaid += baseAmount;
      } else if (entryType === 'expense' && fundingSource === 'member_direct') {
        payerStats.totalPaidOutOfPocket += baseAmount;
      }
    }

    if (entryType === 'settlement' && recipientId) {
      const recipientStats = memberStats.get(recipientId);
      if (recipientStats) {
        recipientStats.totalSettledReceived += baseAmount;
      }
    }

    if (entryType === 'expense') {
      if (splitBreakdown.length > 0) {
        for (const item of splitBreakdown) {
          const mId = toNumber(item.memberId ?? item.id);
          const mStats = memberStats.get(mId);
          if (mStats) {
            const share = (toNumber(item.shareAmount) || 0) * rate;
            mStats.totalConsumedShare += share;
          }
        }
      } else {
        const perPerson = participants.length > 0 ? baseAmount / participants.length : 0;
        for (const p of participants) {
          const mStats = memberStats.get(p.id);
          if (mStats) mStats.totalConsumedShare += perPerson;
        }
      }
    }

    return {
      id: toNumber(row.id),
      amount,
      baseAmount,
      category: String(row.category || 'Travel'),
      description: String(row.description || ''),
      date: String(row.date || ''),
      tourId,
      paidBy: payerId,
      paidByParticipantId: payerId,
      paidByName: row.paid_by_name ? String(row.paid_by_name) : pMap.get(payerId)?.name || null,
      recipientMemberId: recipientId,
      recipientName: row.recipient_name ? String(row.recipient_name) : recipientId ? pMap.get(recipientId)?.name || null : null,
      entryType,
      fundingSource,
      splitType: (row.split_type || 'equal') as 'equal' | 'percentage' | 'exact' | 'shares',
      currency: String(row.currency || tour.base_currency || 'BDT'),
      exchangeRateToTourBase: rate,
      linkedAccountId: toNullableNumber(row.linked_account_id),
      linkedTransactionId: toNullableNumber(row.linked_transaction_id),
      splitBreakdown,
      createdById: toNullableNumber(row.created_by_user_id),
      createdByName: row.created_by_name ? String(row.created_by_name) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
    };
  });

  const detailedMembers = participants.map((p) => {
    const stats = memberStats.get(p.id) || {
      totalPaidOutOfPocket: 0,
      totalDepositedToKitty: 0,
      totalConsumedShare: 0,
      totalSettledPaid: 0,
      totalSettledReceived: 0,
    };

    const netBalance = Math.round(
      ((stats.totalPaidOutOfPocket + stats.totalDepositedToKitty + stats.totalSettledPaid) -
        (stats.totalConsumedShare + stats.totalSettledReceived)) * 100
    ) / 100;

    const initials = p.name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'TM';

    return {
      id: p.id,
      tourId: p.tourId,
      name: p.name,
      userId: p.userId,
      avatar: initials,
      totalPaidOutOfPocket: Math.round(stats.totalPaidOutOfPocket * 100) / 100,
      totalDepositedToKitty: Math.round(stats.totalDepositedToKitty * 100) / 100,
      totalConsumedShare: Math.round(stats.totalConsumedShare * 100) / 100,
      netBalance,
    };
  });

  const balanceNodes: BalanceNode[] = detailedMembers.map((m) => ({
    userId: m.id,
    userName: m.name,
    netBalance: m.netBalance,
  }));

  const settlementTransfers = calculateMinSettlements(
    balanceNodes,
    [],
    0,
    String(tour.base_currency || 'BDT')
  );

  const standardCategories = ['Accommodation', 'Transport', 'Food & Dining', 'Activities', 'Shopping', 'Miscellaneous'];
  const categorySpentMap = new Map<string, number>();
  for (const cat of standardCategories) categorySpentMap.set(cat, 0);

  let totalExpenseSpend = 0;
  for (const s of detailedSpendings) {
    if (s.entryType === 'expense') {
      totalExpenseSpend += s.baseAmount;
      const existing = categorySpentMap.get(s.category) || 0;
      categorySpentMap.set(s.category, existing + s.baseAmount);
    }
  }

  const categoryBreakdown = standardCategories.map((cat) => {
    const spent = Math.round((categorySpentMap.get(cat) || 0) * 100) / 100;
    const percentage = totalExpenseSpend > 0 ? Math.round((spent / totalExpenseSpend) * 1000) / 10 : 0;
    return {
      category: cat,
      spent,
      budget: 0,
      percentage,
    };
  });

  return {
    success: true,
    tour: {
      id: toNumber(tour.id),
      name: String(tour.name || ''),
      destination: tour.destination ? String(tour.destination) : null,
      startDate: tour.start_date ? String(tour.start_date) : null,
      endDate: tour.end_date ? String(tour.end_date) : null,
      baseCurrency: String(tour.base_currency || 'BDT'),
      totalBudget: toNumber(tour.total_budget, 0),
      inviteCode: tour.invite_code ? String(tour.invite_code) : null,
      status: String(tour.status || 'active'),
      createdAt: tour.created_at ? String(tour.created_at) : null,
      createdBy: toNumber(tour.created_by),
    },
    members: detailedMembers,
    kittySummary,
    spendings: detailedSpendings,
    settlementPlan: {
      simplifiedTransfers: settlementTransfers.simplifiedTransfers,
      transfersSavedCount: settlementTransfers.transfersSavedCount,
      rawTransactionsCount: settlementTransfers.rawTransactionsCount,
    },
    categoryBreakdown,
    participants: detailedMembers.map((m) => ({ id: m.id, tourId: m.tourId, name: m.name, userId: m.userId })),
    transactions: detailedSpendings,
    totalSpent: Math.round(totalExpenseSpend * 100) / 100,
    perPerson: detailedMembers.length > 0 ? Math.round((totalExpenseSpend / detailedMembers.length) * 100) / 100 : 0,
    averageCost: detailedSpendings.filter((s) => s.entryType === 'expense').length > 0
      ? Math.round((totalExpenseSpend / detailedSpendings.filter((s) => s.entryType === 'expense').length) * 100) / 100
      : 0,
    transactionCount: detailedSpendings.length,
    balances: detailedMembers.map((m) => ({
      id: m.id,
      tourId: m.tourId,
      name: m.name,
      userId: m.userId,
      paid: m.totalPaidOutOfPocket,
      balance: m.netBalance,
    })),
  };
}

export async function getTour(
  _request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);
  const workspace = await getTourWorkspace(userId, tourId);

  if (!workspace) {
    return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });
  }

  return NextResponse.json(workspace);
}

const UpdateTourSchema = z.object({
  name: z.string().min(1, 'Tour name is required').max(100),
  participants: z.array(z.object({
    id: z.number().optional(),
    name: z.string().min(1).max(100),
    isDeleted: z.boolean().optional()
  })).min(1, 'At least one participant is required')
});

export async function updateTour(
  request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);
  const body = await request.json().catch(() => ({}));
  const validationResult = UpdateTourSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validationResult.error.issues },
      { status: 400 }
    );
  }

  const { name, participants } = validationResult.data;

  // Verify ownership
  const tour = await queryOne<DbRow>(
    'SELECT id FROM tours WHERE id = ? AND created_by = ?',
    [tourId, userId]
  );

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found or not authorized' }, { status: 403 });
  }

  try {
    // Update name
    await run('UPDATE tours SET name = ? WHERE id = ?', [name, tourId]);

    // Handle participants
    for (const p of participants) {
      if (p.id) {
        if (p.isDeleted) {
          // Check if they have transactions
          const countRow = await queryOne<DbRow>(
            'SELECT COUNT(*) as count FROM tour_spendings WHERE tour_id = ? AND paid_by_participant_id = ?',
            [tourId, p.id]
          );
          if (toNumber(countRow?.count) > 0) {
            return NextResponse.json(
              { success: false, error: `Cannot delete participant "${p.name}" because they are involved in existing transactions.` },
              { status: 400 }
            );
          }
          await run('DELETE FROM tour_participants WHERE id = ? AND tour_id = ?', [p.id, tourId]);
        } else {
          await run('UPDATE tour_participants SET name = ? WHERE id = ? AND tour_id = ?', [p.name, p.id, tourId]);
        }
      } else if (!p.isDeleted) {
        await run('INSERT INTO tour_participants (tour_id, name) VALUES (?, ?)', [tourId, p.name]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function deleteTour(
  _request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);

  // Only the creator can delete a tour
  const tour = await queryOne<DbRow>(
    'SELECT id FROM tours WHERE id = ? AND created_by = ?',
    [tourId, userId]
  );

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found or not authorized' }, { status: 404 });
  }

  await run('DELETE FROM tour_spendings WHERE tour_id = ?', [tourId]);
  await run('DELETE FROM tour_participants WHERE tour_id = ?', [tourId]);
  await run('DELETE FROM tours WHERE id = ? AND created_by = ?', [tourId, userId]);
  await run('DELETE FROM tour_groups WHERE id = ? AND user_id = ?', [tourId, userId]).catch(() => undefined);

  return NextResponse.json({ success: true });
}

export async function listTourSpendings(
  _request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);
  const tour = await getTourPayload(userId, tourId);

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });
  }

  const transactions = await getTourTransactions(userId, tourId);
  return NextResponse.json({ success: true, transactions });
}

export async function addTourSpending(
  request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);
  const body = await request.json();
  const data = TourTransactionSchema.parse(body);
  const tour = await getTourPayload(userId, tourId);

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });
  }

  const participants = await getParticipants(tourId);
  const pMap = new Map(participants.map((p) => [p.id, p]));

  const participant = pMap.get(data.paidBy);
  if (!participant) {
    return NextResponse.json({ success: false, error: 'Paid by must be one of this tour\'s participants' }, { status: 400 });
  }

  const entryType = data.entryType || 'expense';
  const fundingSource = data.fundingSource || 'member_direct';
  const splitType = data.splitType || 'equal';
  const currency = data.currency || 'BDT';
  const rate = data.exchangeRateToTourBase || 1.0;

  let splitBreakdown: Array<{
    memberId: number;
    memberName: string;
    shareAmount: number;
    sharePercentage: number;
    shareWeight: number;
    isSettled: boolean;
  }> = [];

  if (entryType === 'expense') {
    let participantInputs: { id: number; name: string; weight: number }[] = [];
    if (data.customSplits && data.customSplits.length > 0) {
      participantInputs = data.customSplits.map((cs) => {
        let weight = 1.0;
        if (splitType === 'shares') weight = cs.shareWeight ?? 1.0;
        else if (splitType === 'percentage') weight = cs.sharePercentage ?? 0;
        else if (splitType === 'exact') weight = cs.shareAmount ?? 0;
        return {
          id: cs.memberId,
          name: pMap.get(cs.memberId)?.name || `Member #${cs.memberId}`,
          weight,
        };
      });
    } else {
      participantInputs = participants.map((p) => ({
        id: p.id,
        name: p.name,
        weight: 1.0,
      }));
    }

    const allocated = allocatePennyShares(data.amount, participantInputs);
    splitBreakdown = allocated.map((a, idx) => ({
      memberId: toNumber(a.id),
      memberName: a.name || pMap.get(toNumber(a.id))?.name || `Member #${a.id}`,
      shareAmount: a.shareAmount,
      sharePercentage: a.sharePercentage,
      shareWeight: participantInputs[idx]?.weight ?? 1,
      isSettled: false,
    }));
  } else if (entryType === 'settlement' && data.recipientMemberId) {
    const recipient = pMap.get(data.recipientMemberId);
    if (!recipient) {
      return NextResponse.json({ success: false, error: 'Recipient must be one of this tour\'s participants' }, { status: 400 });
    }
    splitBreakdown = [
      {
        memberId: data.recipientMemberId,
        memberName: recipient.name,
        shareAmount: data.amount,
        sharePercentage: 100,
        shareWeight: 1,
        isSettled: true,
      },
    ];
  }

  const splitBreakdownJson = JSON.stringify(splitBreakdown);

  const result = await run(
    `INSERT INTO tour_spendings (
       tour_id,
       amount,
       category,
       description,
       date,
       paid_by_participant_id,
       payer_member_id,
       recipient_member_id,
       entry_type,
       funding_source,
       split_type,
       currency,
       exchange_rate_to_tour_base,
       linked_account_id,
       split_breakdown_json,
       created_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tourId,
      data.amount,
      data.category,
      data.description,
      data.date,
      data.paidBy,
      data.paidBy,
      data.recipientMemberId || null,
      entryType,
      fundingSource,
      splitType,
      currency,
      rate,
      data.linkedAccountId || null,
      splitBreakdownJson,
      userId,
    ]
  );

  const spendingId = result.lastInsertRowid;
  let linkedTransactionId: number | null = null;

  if (entryType === 'settlement' && data.linkedAccountId) {
    const userPart = participants.find((p) => p.userId === userId);
    const isPayer = userPart ? userPart.id === data.paidBy : true;
    const counterpartId = isPayer ? data.recipientMemberId : data.paidBy;
    const counterpartName = counterpartId ? pMap.get(counterpartId)?.name : 'Member';

    linkedTransactionId = (await recordTourSettlementTransfer({
      tourId,
      spendingId,
      userId,
      amount: data.amount,
      isPayer,
      linkedAccountId: data.linkedAccountId,
      counterpartName,
      date: data.date,
    })) ?? null;

    if (linkedTransactionId) {
      await run('UPDATE tour_spendings SET linked_transaction_id = ? WHERE id = ?', [
        linkedTransactionId,
        spendingId,
      ]);
    }
  } else if (data.linkedAccountId || data.includeInMainLedger) {
    const syncRes = await syncTourSpendingToPersonalLedger({
      tourId,
      spendingId,
      totalAmount: data.amount,
      category: data.category,
      description: data.description,
      date: data.date,
      payerParticipantId: data.paidBy,
      linkedAccountId: data.linkedAccountId,
      splitType,
      splitBreakdownJson,
      currentUserId: userId,
    });
    linkedTransactionId = syncRes.linkedTransactionId ?? null;
    if (linkedTransactionId) {
      await run('UPDATE tour_spendings SET linked_transaction_id = ? WHERE id = ?', [
        linkedTransactionId,
        spendingId,
      ]);
    }
  }

  broadcastTourUpdate(tourId, {
    type: 'spending_created',
    data: { spendingId, entryType, amount: data.amount },
  });

  const transactionRows = await queryAll<DbRow>(
    `SELECT
       t.id,
       t.amount,
       t.category,
       t.description,
       t.date,
       t.tour_id,
       t.paid_by_participant_id AS paidBy,
       t.paid_by_participant_id,
       t.paid_by_participant_id AS paid_by,
       t.payer_member_id,
       t.recipient_member_id,
       t.entry_type,
       t.funding_source,
       t.split_type,
       t.currency,
       t.exchange_rate_to_tour_base,
       t.linked_account_id,
       t.linked_transaction_id,
       t.split_breakdown_json,
       t.created_at,
       t.created_by_user_id,
       p.name AS paid_by_name,
       r.name AS recipient_name,
       u.name AS created_by_name
     FROM tour_spendings t
     LEFT JOIN tour_participants p ON p.id = t.paid_by_participant_id
     LEFT JOIN tour_participants r ON r.id = t.recipient_member_id
     LEFT JOIN users u ON u.id = t.created_by_user_id
     WHERE t.id = ?
     LIMIT 1`,
    [spendingId]
  );

  return NextResponse.json(
    {
      success: true,
      transaction: normalizeTransaction(transactionRows[0] ?? {
        id: spendingId,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
        tour_id: tourId,
        paidBy: data.paidBy,
        split_type: data.splitType,
      }),
    },
    { status: 201 }
  );
}

export async function updateTourSpending(
  request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId & { params: Promise<{ spendingId: string }> }
) {
  const tourId = await resolveTourId(routeContext);
  const { spendingId } = await (routeContext?.params ?? { spendingId: '' });
  const txId = parseInt(spendingId, 10);
  
  if (!Number.isFinite(txId)) {
    return NextResponse.json({ success: false, error: 'Invalid spending ID' }, { status: 400 });
  }

  const body = await request.json();
  const data = TourTransactionSchema.parse(body);
  const tour = await getTourPayload(userId, tourId);

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });
  }

  const existingTx = await queryOne<{
    id: number;
    linked_transaction_id: number | null;
    linked_account_id: number | null;
  }>(
    'SELECT id, linked_transaction_id, linked_account_id FROM tour_spendings WHERE id = ? AND tour_id = ?',
    [txId, tourId]
  );

  if (!existingTx) {
    return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
  }

  const participants = await getParticipants(tourId);
  const pMap = new Map(participants.map((p) => [p.id, p]));

  const participant = pMap.get(data.paidBy);
  if (!participant) {
    return NextResponse.json({ success: false, error: 'Paid by must be one of this tour\'s participants' }, { status: 400 });
  }

  const entryType = data.entryType || 'expense';
  const fundingSource = data.fundingSource || 'member_direct';
  const splitType = data.splitType || 'equal';
  const currency = data.currency || 'BDT';
  const rate = data.exchangeRateToTourBase || 1.0;

  let splitBreakdown: Array<{
    memberId: number;
    memberName: string;
    shareAmount: number;
    sharePercentage: number;
    shareWeight: number;
    isSettled: boolean;
  }> = [];

  if (entryType === 'expense') {
    let participantInputs: { id: number; name: string; weight: number }[] = [];
    if (data.customSplits && data.customSplits.length > 0) {
      participantInputs = data.customSplits.map((cs) => {
        let weight = 1.0;
        if (splitType === 'shares') weight = cs.shareWeight ?? 1.0;
        else if (splitType === 'percentage') weight = cs.sharePercentage ?? 0;
        else if (splitType === 'exact') weight = cs.shareAmount ?? 0;
        return {
          id: cs.memberId,
          name: pMap.get(cs.memberId)?.name || `Member #${cs.memberId}`,
          weight,
        };
      });
    } else {
      participantInputs = participants.map((p) => ({
        id: p.id,
        name: p.name,
        weight: 1.0,
      }));
    }

    const allocated = allocatePennyShares(data.amount, participantInputs);
    splitBreakdown = allocated.map((a, idx) => ({
      memberId: toNumber(a.id),
      memberName: a.name || pMap.get(toNumber(a.id))?.name || `Member #${a.id}`,
      shareAmount: a.shareAmount,
      sharePercentage: a.sharePercentage,
      shareWeight: participantInputs[idx]?.weight ?? 1,
      isSettled: false,
    }));
  }

  const splitBreakdownJson = JSON.stringify(splitBreakdown);

  await run(
    `UPDATE tour_spendings SET
       amount = ?,
       category = ?,
       description = ?,
       date = ?,
       paid_by_participant_id = ?,
       payer_member_id = ?,
       recipient_member_id = ?,
       entry_type = ?,
       funding_source = ?,
       split_type = ?,
       currency = ?,
       exchange_rate_to_tour_base = ?,
       linked_account_id = ?,
       split_breakdown_json = ?
     WHERE id = ? AND tour_id = ?`,
    [
      data.amount,
      data.category,
      data.description,
      data.date,
      data.paidBy,
      data.paidBy,
      data.recipientMemberId || null,
      entryType,
      fundingSource,
      splitType,
      currency,
      rate,
      data.linkedAccountId ?? existingTx.linked_account_id ?? null,
      splitBreakdownJson,
      txId,
      tourId,
    ]
  );

  const effectiveAccountId = data.linkedAccountId ?? existingTx.linked_account_id;
  if (effectiveAccountId || existingTx.linked_transaction_id) {
    const syncRes = await syncTourSpendingToPersonalLedger({
      tourId,
      spendingId: txId,
      totalAmount: data.amount,
      category: data.category,
      description: data.description,
      date: data.date,
      payerParticipantId: data.paidBy,
      linkedAccountId: effectiveAccountId,
      splitType,
      splitBreakdownJson,
      currentUserId: userId,
    });
    if (syncRes.linkedTransactionId && syncRes.linkedTransactionId !== existingTx.linked_transaction_id) {
      await run('UPDATE tour_spendings SET linked_transaction_id = ? WHERE id = ?', [
        syncRes.linkedTransactionId,
        txId,
      ]);
    }
  }

  broadcastTourUpdate(tourId, {
    type: 'spending_updated',
    data: { spendingId: txId },
  });

  const transactionRows = await queryAll<DbRow>(
    `SELECT
       t.id,
       t.amount,
       t.category,
       t.description,
       t.date,
       t.tour_id,
       t.paid_by_participant_id AS paidBy,
       t.paid_by_participant_id,
       t.paid_by_participant_id AS paid_by,
       t.payer_member_id,
       t.recipient_member_id,
       t.entry_type,
       t.funding_source,
       t.split_type,
       t.currency,
       t.exchange_rate_to_tour_base,
       t.linked_account_id,
       t.linked_transaction_id,
       t.split_breakdown_json,
       t.created_at,
       t.created_by_user_id,
       p.name AS paid_by_name,
       r.name AS recipient_name,
       u.name AS created_by_name
     FROM tour_spendings t
     LEFT JOIN tour_participants p ON p.id = t.paid_by_participant_id
     LEFT JOIN tour_participants r ON r.id = t.recipient_member_id
     LEFT JOIN users u ON u.id = t.created_by_user_id
     WHERE t.id = ?
     LIMIT 1`,
    [txId]
  );

  return NextResponse.json({
    success: true,
    transaction: normalizeTransaction(transactionRows[0] ?? {
      id: txId,
      amount: data.amount,
      category: data.category,
      description: data.description,
      date: data.date,
      tour_id: tourId,
      paidBy: data.paidBy,
      split_type: data.splitType,
    }),
  });
}

export async function deleteTourSpending(
  _request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId & { params: Promise<{ spendingId: string }> }
) {
  const tourId = await resolveTourId(routeContext);
  const { spendingId } = await (routeContext?.params ?? { spendingId: '' });
  const txId = parseInt(spendingId, 10);
  
  if (!Number.isFinite(txId)) {
    return NextResponse.json({ success: false, error: 'Invalid spending ID' }, { status: 400 });
  }

  const tour = await getTourPayload(userId, tourId);
  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });
  }

  const existingTx = await queryOne<{ id: number; linked_transaction_id: number | null }>(
    'SELECT id, linked_transaction_id FROM tour_spendings WHERE id = ? AND tour_id = ?',
    [txId, tourId]
  );

  if (!existingTx) {
    return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
  }

  await deleteTourSpendingPersonalLedger(tourId, txId, userId);

  await run('DELETE FROM tour_spendings WHERE id = ? AND tour_id = ?', [txId, tourId]);

  broadcastTourUpdate(tourId, {
    type: 'spending_deleted',
    data: { spendingId: txId },
  });

  return NextResponse.json({ success: true });
}

// ═══════════════════════════════════════════════════════════════
//  INVITE & JOIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function generateUrlSafeCode(length = 12): string {
  return randomBytes(length)
    .toString('base64url')
    .slice(0, length);
}

export async function generateInviteCode(
  _request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);

  // Only the creator can generate invite codes
  const tour = await queryOne<{ id: number; invite_code: string | null }>(
    'SELECT id, invite_code FROM tours WHERE id = ? AND created_by = ?',
    [tourId, userId]
  );

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found or not authorized' }, { status: 404 });
  }

  // If an invite code already exists, return it
  if (tour.invite_code) {
    return NextResponse.json({
      success: true,
      inviteCode: tour.invite_code,
      inviteUrl: `/tours/join/${tour.invite_code}`,
    });
  }

  // Generate a new unique code
  let code = generateUrlSafeCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM tours WHERE invite_code = ?',
      [code]
    );
    if (!existing) break;
    code = generateUrlSafeCode();
    attempts++;
  }

  await run('UPDATE tours SET invite_code = ? WHERE id = ? AND created_by = ?', [code, tourId, userId]);

  return NextResponse.json({
    success: true,
    inviteCode: code,
    inviteUrl: `/tours/join/${code}`,
  });
}

export async function getInviteCode(
  _request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);

  const tour = await queryOne<{ id: number; invite_code: string | null }>(
    'SELECT id, invite_code FROM tours WHERE id = ? AND created_by = ?',
    [tourId, userId]
  );

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found or not authorized' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    inviteCode: tour.invite_code ?? null,
    inviteUrl: tour.invite_code ? `/tours/join/${tour.invite_code}` : null,
  });
}

export async function getTourByInviteCode(code: string, userId: number) {
  const tour = await queryOne<DbRow>(
    'SELECT id, name, created_by, created_at FROM tours WHERE invite_code = ?',
    [code]
  );

  if (!tour) return null;

  const tourId = toNumber(tour.id);
  const participants = await getParticipants(tourId);

  // Check if user is already joined
  const alreadyJoined = participants.some(p => p.userId === userId);
  const isCreator = toNumber(tour.created_by) === userId;

  return {
    id: tourId,
    name: String(tour.name ?? ''),
    createdAt: tour.created_at ? String(tour.created_at) : null,
    participants: participants.map(p => ({
      id: p.id,
      name: p.name,
      isClaimed: p.userId !== null,
      isCurrentUser: p.userId === userId,
    })),
    alreadyJoined: alreadyJoined || isCreator,
    isCreator,
  };
}

export async function joinTour(
  request: NextRequest,
  userId: number
) {
  const body = await request.json();
  const { code, participantId } = body;

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ success: false, error: 'Invite code is required' }, { status: 400 });
  }

  if (!participantId || typeof participantId !== 'number') {
    return NextResponse.json({ success: false, error: 'Participant selection is required' }, { status: 400 });
  }

  const tour = await queryOne<{ id: number }>(
    'SELECT id FROM tours WHERE invite_code = ?',
    [code]
  );

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Invalid invite code' }, { status: 404 });
  }

  const tourId = toNumber(tour.id);

  // Check if user is already bound to a participant in this tour
  const existingBinding = await queryOne<{ id: number }>(
    'SELECT id FROM tour_participants WHERE tour_id = ? AND user_id = ?',
    [tourId, userId]
  );

  if (existingBinding) {
    return NextResponse.json({ success: false, error: 'You are already a member of this tour' }, { status: 409 });
  }

  // Verify the participant exists and isn't already claimed
  const participant = await queryOne<{ id: number; user_id: number | null }>(
    'SELECT id, user_id FROM tour_participants WHERE id = ? AND tour_id = ?',
    [participantId, tourId]
  );

  if (!participant) {
    return NextResponse.json({ success: false, error: 'Participant not found in this tour' }, { status: 404 });
  }

  if (participant.user_id !== null) {
    return NextResponse.json({ success: false, error: 'This participant slot is already claimed' }, { status: 409 });
  }

  // Bind the user to the participant
  await run(
    'UPDATE tour_participants SET user_id = ? WHERE id = ? AND tour_id = ?',
    [userId, participantId, tourId]
  );

  return NextResponse.json({ success: true, tourId });
}
