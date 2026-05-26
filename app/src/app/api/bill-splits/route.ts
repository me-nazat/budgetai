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
    const body = await request.json();
    // Support both naming conventions depending on client payload
    const description = body.description;
    const totalAmount = body.totalAmount || body.total_amount;
    const date = body.date || new Date().toISOString();
    const splitMode = body.splitMode || body.split_mode || 'Equal';
    const participants = body.participants || (body.participants_json ? JSON.parse(body.participants_json) : []);

    if (!description || totalAmount == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { lastInsertRowid } = await run(
      `INSERT INTO bill_splits (user_id, description, total_amount, date, split_mode, participants_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, description, totalAmount, date, splitMode, JSON.stringify(participants)]
    );

    const newSplit = await queryOne(
      `SELECT id, description, total_amount as totalAmount, date, split_mode as splitMode, participants_json, created_at FROM bill_splits WHERE id = ?`,
      [lastInsertRowid]
    );

    return NextResponse.json({
      ...(newSplit as any),
      participants: JSON.parse((newSplit as any).participants_json || '[]')
    }, { status: 201 });
  })
);
