import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import { queryAll, queryOne, run } from '@/lib/db';
import { BADGES, getUnlockedBadges, UserStats } from '@/lib/badges';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-for-dev');

async function getUserId() {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jose.jwtVerify(token, JWT_SECRET);
        return payload.userId as number;
    } catch {
        return null;
    }
}

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Calculate Stats
        const txCountRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', [userId]);
        const savingsRes = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM savings_goals WHERE user_id = ? AND saved_amount >= target_amount', [userId]);
        const netWorthRes = await queryOne<{ amount: number }>('SELECT amount FROM net_worth WHERE user_id = ? ORDER BY date(created_at) DESC LIMIT 1', [userId]);
        
        // Months under budget is a bit complex, we'll approximate based on how many budgets they have
        // that have a limit >= spent. But for now we use a simpler approach:
        const stats: UserStats = {
            totalTransactions: txCountRes?.count || 0,
            totalSavingsGoalsMet: savingsRes?.count || 0,
            consecutiveLoginDays: 1, // Simulated
            monthsUnderBudget: 0, // Simulated for now
            netWorth: netWorthRes?.amount || 0
        };

        const earnedBadgeIds = getUnlockedBadges(stats);

        // Fetch already stored badges
        const existingBadges = await queryAll<{ badge_id: string }>('SELECT badge_id FROM user_badges WHERE user_id = ?', [userId]);
        const existingIds = existingBadges.map(b => b.badge_id);

        // Insert new ones
        const newBadges = earnedBadgeIds.filter(id => !existingIds.includes(id));
        for (const id of newBadges) {
            await run('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)', [userId, id]);
        }

        const allUnlockedIds = [...existingIds, ...newBadges];

        const responseBadges = BADGES.map(b => ({
            ...b,
            unlocked: allUnlockedIds.includes(b.id)
        }));

        return NextResponse.json({ badges: responseBadges, stats });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
    }
}
