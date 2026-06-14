import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { CreateTourSchema, TourIdParamSchema, TourTransactionSchema } from '@/lib/validation';

type RouteContextWithId = {
  params?: Promise<{ id: string }> | { id: string };
};

type DbRow = Record<string, unknown>;

interface TourParticipantResponse {
  id: number;
  tourId: number;
  name: string;
  userId: number | null;
}

interface TourTransactionResponse {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  tourId: number;
  paidBy: number;
  paidByParticipantId: number;
  paidByName: string | null;
  splitType: 'equal' | 'percentage' | 'exact';
  createdAt: string | null;
}

interface TourResponse {
  id: number;
  name: string;
  createdAt: string | null;
  createdBy: number;
  participants: TourParticipantResponse[];
  transactions?: TourTransactionResponse[];
  totalSpent?: number;
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

  return {
    id: toNumber(row.id),
    amount: toNumber(row.amount),
    category: String(row.category ?? 'Travel'),
    description: String(row.description ?? ''),
    date: String(row.date ?? ''),
    tourId: toNumber(row.tour_id ?? row.tourId),
    paidBy,
    paidByParticipantId: paidBy,
    paidByName: row.paid_by_name ? String(row.paid_by_name) : null,
    splitType: (row.split_type ?? row.splitType ?? 'equal') as TourTransactionResponse['splitType'],
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

function normalizeTour(row: DbRow, participants: TourParticipantResponse[], totalSpent = 0): TourResponse {
  return {
    id: toNumber(row.id),
    name: String(row.name ?? ''),
    createdAt: row.created_at ? String(row.created_at) : null,
    createdBy: toNumber(row.created_by ?? row.user_id),
    participants,
    totalSpent,
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
       COALESCE(t.paid_by_participant_id, t.paid_by) AS paidBy,
       t.paid_by_participant_id,
       t.paid_by,
       t.split_type,
       t.created_at,
       p.name AS paid_by_name
     FROM transactions t
     LEFT JOIN tour_participants p
       ON p.id = COALESCE(t.paid_by_participant_id, t.paid_by)
     WHERE t.user_id = ? AND t.tour_id = ?
     ORDER BY t.date DESC, t.created_at DESC, t.id DESC`,
    [userId, tourId]
  );

  return rows.map(normalizeTransaction);
}

async function getTourTotal(userId: number, tourId: number): Promise<number> {
  const row = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = ? AND tour_id = ?`,
    [userId, tourId]
  );

  return toNumber(row?.total);
}

async function getTourPayload(
  userId: number,
  tourId: number,
  includeTransactions = false
): Promise<TourResponse | null> {
  const tour = await queryOne<DbRow>(
    `SELECT id, created_by, name, created_at
     FROM tours
     WHERE id = ? AND created_by = ?`,
    [tourId, userId]
  );

  if (!tour) return null;

  const [participants, totalSpent, transactions] = await Promise.all([
    getParticipants(tourId),
    getTourTotal(userId, tourId),
    includeTransactions ? getTourTransactions(userId, tourId) : Promise.resolve(undefined),
  ]);

  return {
    ...normalizeTour(tour, participants, totalSpent),
    ...(transactions ? { transactions } : {}),
  };
}

export async function listTours(_request: NextRequest, userId: number) {
  const tours = await queryAll<DbRow>(
    `SELECT id, created_by, name, created_at
     FROM tours
     WHERE created_by = ?
     ORDER BY datetime(created_at) DESC, id DESC`,
    [userId]
  );

  const hydratedTours = await Promise.all(
    tours.map(async (tour) => {
      const tourId = toNumber(tour.id);
      const [participants, totalSpent] = await Promise.all([
        getParticipants(tourId),
        getTourTotal(userId, tourId),
      ]);

      return normalizeTour(tour, participants, totalSpent);
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
      'INSERT INTO tours (created_by, name) VALUES (?, ?)',
      [userId, data.name]
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

export async function getTour(
  _request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);
  const tour = await getTourPayload(userId, tourId, true);

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    tour: {
      id: tour.id,
      name: tour.name,
      createdAt: tour.createdAt,
      createdBy: tour.createdBy,
    },
    participants: tour.participants,
    transactions: tour.transactions ?? [],
    totalSpent: tour.totalSpent ?? 0,
  });
}

export async function deleteTour(
  _request: NextRequest,
  userId: number,
  routeContext?: RouteContextWithId
) {
  const tourId = await resolveTourId(routeContext);
  const tour = await getTourPayload(userId, tourId);

  if (!tour) {
    return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });
  }

  await run('DELETE FROM transactions WHERE user_id = ? AND tour_id = ?', [userId, tourId]);
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

  const participant = await queryOne<{ id: number }>(
    'SELECT id FROM tour_participants WHERE id = ? AND tour_id = ?',
    [data.paidBy, tourId]
  );

  if (!participant) {
    return NextResponse.json({ success: false, error: 'Paid by must be one of this tour\'s participants' }, { status: 400 });
  }

  const result = await run(
    `INSERT INTO transactions (
       user_id,
       type,
       amount,
       category,
       description,
       date,
       tour_id,
       paid_by,
       paid_by_participant_id,
       split_type
     ) VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.amount,
      data.category,
      data.description,
      data.date,
      tourId,
      data.paidBy,
      data.paidBy,
      data.splitType,
    ]
  );

  const transactionRows = await queryAll<DbRow>(
    `SELECT
       t.id,
       t.amount,
       t.category,
       t.description,
       t.date,
       t.tour_id,
       COALESCE(t.paid_by_participant_id, t.paid_by) AS paidBy,
       t.paid_by_participant_id,
       t.paid_by,
       t.split_type,
       t.created_at,
       p.name AS paid_by_name
     FROM transactions t
     LEFT JOIN tour_participants p
       ON p.id = COALESCE(t.paid_by_participant_id, t.paid_by)
     WHERE t.id = ? AND t.user_id = ?
     LIMIT 1`,
    [result.lastInsertRowid, userId]
  );

  return NextResponse.json({
    success: true,
    transaction: normalizeTransaction(transactionRows[0] ?? {
      id: result.lastInsertRowid,
      amount: data.amount,
      category: data.category,
      description: data.description,
      date: data.date,
      tour_id: tourId,
      paidBy: data.paidBy,
      split_type: data.splitType,
    }),
  }, { status: 201 });
}
