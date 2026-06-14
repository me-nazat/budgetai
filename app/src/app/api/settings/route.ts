export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryOne, run } from '@/lib/db';
import { validateInput } from '@/lib/types/api';
import { UpdateSettingsDTO } from '@/lib/types/dto';

export const GET = apiHandler(
    withAuth(async (request: NextRequest, { userId }) => {
        const user = await queryOne<{ id: number; name: string; email: string; currency: string; notifyBudget: number; notifyOverspend: number }>(
            'SELECT id, name, email, currency, notify_budget, notify_overspend FROM users WHERE id = ?',
            [userId]
        );
        return NextResponse.json({ user });
    })
);

export const PUT = apiHandler(
    withAuth(async (request: NextRequest, { userId }) => {
        const body = await request.json();
        const data = validateInput(UpdateSettingsDTO, body);

        // data.name, data.currency, data.notifyBudget, data.notifyOverspend are all validated and sanitized
        const name = data.name !== undefined ? data.name : null;
        const currency = data.currency !== undefined ? data.currency : null;
        const notify_budget = data.notifyBudget !== undefined ? data.notifyBudget : null;
        const notify_overspend = data.notifyOverspend !== undefined ? data.notifyOverspend : null;

        await run(
            'UPDATE users SET name = COALESCE(?, name), currency = COALESCE(?, currency), notify_budget = COALESCE(?, notify_budget), notify_overspend = COALESCE(?, notify_overspend) WHERE id = ?',
            [name, currency, notify_budget, notify_overspend, userId]
        );
        return NextResponse.json({ success: true });
    })
);
