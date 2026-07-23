export const dynamic = 'force-dynamic';

/**
 * @fileoverview Round-Up Auto-Savings API.
 *
 * GET  — Fetch active round-up config and cumulative savings stats
 * POST — Save/update round-up configuration
 *
 * @module api/round-up
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryOne, queryAll, run } from '@/lib/db';

const ConfigSchema = z.object({
  roundUpUnit: z.number().int().positive().default(10), // e.g. round to nearest 10, 50, 100
  goalId: z.number().int().optional(),
  active: z.number().int().min(0).max(1).default(1),
});

export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    // Ensure table exists
    await run(`
      CREATE TABLE IF NOT EXISTS round_up_configs (
        user_id INTEGER PRIMARY KEY,
        round_up_unit INTEGER DEFAULT 10,
        goal_id INTEGER,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS round_up_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        transaction_id INTEGER,
        original_amount REAL NOT NULL,
        rounded_amount REAL NOT NULL,
        difference REAL NOT NULL,
        goal_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const config = await queryOne<{ round_up_unit: number; goal_id: number | null; active: number }>(
      'SELECT round_up_unit, goal_id, active FROM round_up_configs WHERE user_id = ?',
      [userId]
    );

    const stats = await queryOne<{ total_saved: number; total_count: number }>(
      'SELECT SUM(difference) as total_saved, COUNT(*) as total_count FROM round_up_ledger WHERE user_id = ?',
      [userId]
    );

    const recentLedger = await queryAll<{
      id: number;
      original_amount: number;
      rounded_amount: number;
      difference: number;
      created_at: string;
    }>(
      'SELECT id, original_amount, rounded_amount, difference, created_at FROM round_up_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );

    return NextResponse.json({
      config: config || { roundUpUnit: 10, goalId: null, active: 0 },
      stats: {
        totalSaved: stats?.total_saved || 0,
        totalCount: stats?.total_count || 0,
      },
      recentLedger,
    });
  })
);

export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = ConfigSchema.parse(body);

    await run(`
      CREATE TABLE IF NOT EXISTS round_up_configs (
        user_id INTEGER PRIMARY KEY,
        round_up_unit INTEGER DEFAULT 10,
        goal_id INTEGER,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const existing = await queryOne<{ user_id: number }>(
      'SELECT user_id FROM round_up_configs WHERE user_id = ?',
      [userId]
    );

    if (existing) {
      await run(
        'UPDATE round_up_configs SET round_up_unit = ?, goal_id = ?, active = ? WHERE user_id = ?',
        [validated.roundUpUnit, validated.goalId || null, validated.active, userId]
      );
    } else {
      await run(
        'INSERT INTO round_up_configs (user_id, round_up_unit, goal_id, active) VALUES (?, ?, ?, ?)',
        [userId, validated.roundUpUnit, validated.goalId || null, validated.active]
      );
    }

    return NextResponse.json({ success: true, message: 'Round-up configuration updated' });
  }),
  { rateLimit: 'api' }
);
