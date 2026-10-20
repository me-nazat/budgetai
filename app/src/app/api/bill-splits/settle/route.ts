export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryOne, run } from '@/lib/db';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { splitId, participantIndex, accountId, amount } = body;

    if (!splitId || participantIndex === undefined) {
      return NextResponse.json({ error: 'splitId and participantIndex are required' }, { status: 400 });
    }

    const split = await queryOne<any>(
      'SELECT id, description, participants_json FROM bill_splits WHERE id = ? AND user_id = ?',
      [splitId, userId]
    );

    if (!split) {
      return NextResponse.json({ error: 'Bill split not found' }, { status: 404 });
    }

    const participants = JSON.parse(split.participants_json || '[]');
    if (!participants[participantIndex]) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    participants[participantIndex].settled = true;
    participants[participantIndex].settledAt = new Date().toISOString();

    await run(
      'UPDATE bill_splits SET participants_json = ? WHERE id = ?',
      [JSON.stringify(participants), splitId]
    );

    const settleAmount = Number(amount) || Number(participants[participantIndex].amount) || Number(participants[participantIndex].share) || 0;

    // If personal account was chosen to receive payment, update balance and log transfer
    if (accountId && settleAmount > 0) {
      const today = new Date().toISOString().split('T')[0];
      await run(
        'UPDATE accounts SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [settleAmount, accountId, userId]
      );

      await run(
        `INSERT INTO transactions (
          user_id, account_id, amount, type, category, description, date, is_settlement_transfer, reimbursement_status, collaborative_source_type, collaborative_source_id
        ) VALUES (?, ?, ?, 'income', 'Settlement', ?, ?, 1, 'settled', 'bill_split', ?)`,
        [
          userId,
          accountId,
          settleAmount,
          `IOU Settled: ${participants[participantIndex].name} paid for ${split.description}`,
          today,
          String(splitId),
        ]
      );
    }

    return NextResponse.json({ success: true, participants });
  })
);
