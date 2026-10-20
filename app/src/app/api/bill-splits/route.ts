export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll, run, queryOne } from '@/lib/db';

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const splits = await queryAll(
      `SELECT id, description, total_amount as totalAmount, date, split_mode as splitMode, participants_json, created_at 
       FROM bill_splits 
       WHERE user_id = ? 
       ORDER BY date DESC, created_at DESC`,
      [userId]
    );

    const parsedSplits = splits.map((s: any) => ({
      ...s,
      participants: JSON.parse(s.participants_json || '[]')
    }));

    return NextResponse.json(parsedSplits);
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const description = body.description;
    const totalAmount = Number(body.totalAmount ?? body.total_amount);
    const date = body.date || new Date().toISOString().split('T')[0];
    const splitMode = body.splitMode || body.split_mode || 'Equal';
    const participants = body.participants || (body.participants_json ? JSON.parse(body.participants_json) : []);
    const accountId = body.accountId ? Number(body.accountId) : null;
    const paidByMe = body.paidByMe ?? true;
    const category = body.category || 'Dining & Food';

    if (!description || !Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ error: 'Missing required fields: description and positive totalAmount' }, { status: 400 });
    }

    // Determine user's share from participants
    let myShare = 0;
    let othersOweTotal = 0;

    if (Array.isArray(participants) && participants.length > 0) {
      for (const p of participants) {
        const share = Number(p.amount ?? p.share ?? 0);
        if (p.isMe || p.isUser || p.userId === userId || p.name?.toLowerCase().includes('(me)')) {
          myShare = share;
        } else {
          othersOweTotal += share;
        }
      }
      if (myShare === 0 && participants.length > 0) {
        myShare = totalAmount / participants.length;
      }
    } else {
      myShare = totalAmount;
    }

    const { lastInsertRowid } = await run(
      `INSERT INTO bill_splits (user_id, description, total_amount, date, split_mode, participants_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, description, totalAmount, date, splitMode, JSON.stringify(participants)]
    );

    const splitId = Number(lastInsertRowid);

    // Sync to transactions and accounts if paid by user
    if (paidByMe) {
      if (accountId) {
        await run(
          'UPDATE accounts SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [totalAmount, accountId, userId]
        );
      }

      await run(
        `INSERT INTO transactions (
          user_id, account_id, amount, type, category, description, date,
          personal_share_amount, reimbursement_status, collaborative_source_type, collaborative_source_id
        ) VALUES (?, ?, ?, 'expense', ?, ?, ?, ?, ?, 'bill_split', ?)`,
        [
          userId,
          accountId,
          totalAmount,
          category,
          `Bill Split: ${description}`,
          date,
          myShare,
          othersOweTotal > 0 ? 'receivable' : 'none',
          String(splitId),
        ]
      );
    } else {
      // Friend paid for user: record payable
      await run(
        `INSERT INTO transactions (
          user_id, account_id, amount, type, category, description, date,
          personal_share_amount, reimbursement_status, collaborative_source_type, collaborative_source_id
        ) VALUES (?, NULL, 0, 'expense', ?, ?, ?, ?, 'payable', 'bill_split', ?)`,
        [
          userId,
          category,
          `Bill Split (Owed to friend): ${description}`,
          date,
          myShare,
          String(splitId),
        ]
      );
    }

    const newSplit = await queryOne(
      `SELECT id, description, total_amount as totalAmount, date, split_mode as splitMode, participants_json, created_at FROM bill_splits WHERE id = ?`,
      [splitId]
    );

    return NextResponse.json({
      ...(newSplit as any),
      participants: JSON.parse((newSplit as any).participants_json || '[]'),
      myShare,
      othersOweTotal,
    }, { status: 201 });
  })
);
