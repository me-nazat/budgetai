import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { CreateTourSchema, TourIdParamSchema, TourTransactionSchema } from '@/lib/validation';
import { randomBytes } from 'crypto';

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
       p.name AS paid_by_name
     FROM tour_spendings t
     LEFT JOIN tour_participants p
       ON p.id = t.paid_by_participant_id
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
    `SELECT DISTINCT t.id, t.created_by, t.name, t.created_at, t.invite_code
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
    `SELECT DISTINCT t.id, t.created_by, t.name, t.created_at
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
    totalSpent: tour.totalSpent,
    perPerson: tour.perPerson,
    averageCost: tour.averageCost,
    transactionCount: tour.transactionCount,
    balances: tour.balances ?? [],
  });
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
      { success: false, error: 'Validation failed', details: validationResult.error.errors },
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

  const participant = await queryOne<{ id: number }>(
    'SELECT id FROM tour_participants WHERE id = ? AND tour_id = ?',
    [data.paidBy, tourId]
  );

  if (!participant) {
    return NextResponse.json({ success: false, error: 'Paid by must be one of this tour\'s participants' }, { status: 400 });
  }

  let linkedTransactionId: number | null = null;
  
  if (data.includeInMainLedger) {
    const mainTxResult = await run(
      `INSERT INTO transactions (
         user_id,
         type,
         amount,
         category,
         description,
         date
       ) VALUES (?, 'expense', ?, ?, ?, ?)`,
      [
        userId,
        data.amount,
        data.category,
        data.description,
        data.date,
      ]
    );
    linkedTransactionId = mainTxResult.lastInsertRowid;
  }

  const result = await run(
    `INSERT INTO tour_spendings (
       tour_id,
       amount,
       category,
       description,
       date,
       paid_by_participant_id,
       split_type,
       linked_transaction_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tourId,
      data.amount,
      data.category,
      data.description,
      data.date,
      data.paidBy,
      data.splitType,
      linkedTransactionId
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
       t.paid_by_participant_id AS paidBy,
       t.paid_by_participant_id,
       t.paid_by_participant_id AS paid_by,
       t.split_type,
       t.created_at,
       p.name AS paid_by_name
     FROM tour_spendings t
     LEFT JOIN tour_participants p
       ON p.id = t.paid_by_participant_id
     WHERE t.id = ?
     LIMIT 1`,
    [result.lastInsertRowid]
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

  const existingTx = await queryOne<{ id: number; linked_transaction_id: number | null }>(
    'SELECT id, linked_transaction_id FROM tour_spendings WHERE id = ? AND tour_id = ?',
    [txId, tourId]
  );

  if (!existingTx) {
    return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
  }

  const participant = await queryOne<{ id: number }>(
    'SELECT id FROM tour_participants WHERE id = ? AND tour_id = ?',
    [data.paidBy, tourId]
  );

  if (!participant) {
    return NextResponse.json({ success: false, error: 'Paid by must be one of this tour\'s participants' }, { status: 400 });
  }

  await run(
    `UPDATE tour_spendings SET
       amount = ?,
       category = ?,
       description = ?,
       date = ?,
       paid_by_participant_id = ?,
       split_type = ?
     WHERE id = ? AND tour_id = ?`,
    [
      data.amount,
      data.category,
      data.description,
      data.date,
      data.paidBy,
      data.splitType,
      txId,
      tourId
    ]
  );

  if (existingTx.linked_transaction_id) {
    await run(
      `UPDATE transactions SET
         amount = ?,
         category = ?,
         description = ?,
         date = ?
       WHERE id = ? AND user_id = ?`,
      [
        data.amount,
        data.category,
        data.description,
        data.date,
        existingTx.linked_transaction_id,
        userId
      ]
    );
  }

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
       t.split_type,
       t.created_at,
       p.name AS paid_by_name
     FROM tour_spendings t
     LEFT JOIN tour_participants p
       ON p.id = t.paid_by_participant_id
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
    })
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

  await run('DELETE FROM tour_spendings WHERE id = ? AND tour_id = ?', [txId, tourId]);

  if (existingTx.linked_transaction_id) {
    await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [existingTx.linked_transaction_id, userId]);
  }

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
