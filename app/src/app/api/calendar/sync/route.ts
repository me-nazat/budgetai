export const dynamic = 'force-dynamic';

/**
 * @fileoverview Calendar Sync API — Syncs recurring bills and subscription reminders to Google Calendar / ICS feed.
 *
 * POST   — Generate calendar events or sync URL
 * GET    — Fetch user's synced calendar events summary
 *
 * @module api/calendar/sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll, queryOne, run } from '@/lib/db';

const SyncSchema = z.object({
  subscriptionId: z.number().int().optional(),
  reminderDays: z.number().int().min(0).max(14).default(3),
});

export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    await run(`
      CREATE TABLE IF NOT EXISTS calendar_sync_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subscription_id INTEGER,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        reminder_days INTEGER DEFAULT 3,
        last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const events = await queryAll<{
      id: number;
      title: string;
      amount: number;
      due_date: string;
      reminder_days: number;
      last_synced_at: string;
    }>(
      'SELECT id, title, amount, due_date, reminder_days, last_synced_at FROM calendar_sync_events WHERE user_id = ? ORDER BY due_date ASC',
      [userId]
    );

    return NextResponse.json({
      syncedCount: events.length,
      events,
    });
  })
);

export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = SyncSchema.parse(body);

    await run(`
      CREATE TABLE IF NOT EXISTS calendar_sync_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subscription_id INTEGER,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        reminder_days INTEGER DEFAULT 3,
        last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fetch recurring subscriptions to sync
    let subs = await queryAll<{ id: number; name: string; amount: number; next_billing_date: string }>(
      'SELECT id, name, amount, next_billing_date FROM subscriptions WHERE user_id = ? AND active = 1',
      [userId]
    );

    if (validated.subscriptionId) {
      subs = subs.filter(s => s.id === validated.subscriptionId);
    }

    let syncedCount = 0;
    for (const sub of subs) {
      const existing = await queryOne<{ id: number }>(
        'SELECT id FROM calendar_sync_events WHERE user_id = ? AND subscription_id = ?',
        [userId, sub.id]
      );

      if (existing) {
        await run(
          'UPDATE calendar_sync_events SET title = ?, amount = ?, due_date = ?, reminder_days = ?, last_synced_at = CURRENT_TIMESTAMP WHERE id = ?',
          [sub.name, sub.amount, sub.next_billing_date, validated.reminderDays, existing.id]
        );
      } else {
        await run(
          'INSERT INTO calendar_sync_events (user_id, subscription_id, title, amount, due_date, reminder_days) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, sub.id, sub.name, sub.amount, sub.next_billing_date, validated.reminderDays]
        );
      }
      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      message: `Synced ${syncedCount} bill${syncedCount === 1 ? '' : 's'} to calendar feed`,
    });
  }),
  { rateLimit: 'api' }
);
