export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, run } from '@/lib/db';
import { isValidAmount, isValidDate, sanitizeName } from '@/lib/validation';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const goals = await queryAll('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC', [session.userId]);
        return NextResponse.json({ goals });
    } catch (error) {
        console.error('Goals error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const name = sanitizeName(body.name);
        const target_amount = typeof body.target_amount === 'string' ? parseFloat(body.target_amount) : body.target_amount;
        const deadline = body.deadline || null;
        const linked_account = body.linked_account || '';

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        if (!isValidAmount(target_amount)) {
            return NextResponse.json({ error: 'Valid target amount required (positive number)' }, { status: 400 });
        }
        if (deadline && !isValidDate(deadline)) {
            return NextResponse.json({ error: 'Invalid deadline format (YYYY-MM-DD)' }, { status: 400 });
        }

        await run(
            'INSERT INTO savings_goals (user_id, name, target_amount, deadline, linked_account) VALUES (?, ?, ?, ?, ?)',
            [session.userId, name, target_amount, deadline, linked_account]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Goals error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const id = body.id;
        const contribution = typeof body.contribution === 'string' ? parseFloat(body.contribution) : body.contribution;

        if (!id || typeof id !== 'number') {
            return NextResponse.json({ error: 'Valid goal ID is required' }, { status: 400 });
        }
        if (!isValidAmount(contribution)) {
            return NextResponse.json({ error: 'Valid contribution amount required (positive number)' }, { status: 400 });
        }

        // Fetch current goal to check milestones
        const goals = await queryAll('SELECT name, target_amount, saved_amount FROM savings_goals WHERE id = ? AND user_id = ?', [id, session.userId]);
        const goal = goals[0] as any;
        
        await run(
            'UPDATE savings_goals SET saved_amount = saved_amount + ? WHERE id = ? AND user_id = ?',
            [contribution, id, session.userId]
        );

        if (goal) {
            const oldSaved = goal.saved_amount;
            const newSaved = oldSaved + contribution;
            const target = goal.target_amount;
            
            const oldPct = oldSaved / target;
            const newPct = newSaved / target;

            // Trigger notification if crossing 50% or 100%
            let alertMsg = '';
            if (oldPct < 0.5 && newPct >= 0.5 && newPct < 1.0) {
                alertMsg = `You are halfway there! 50% reached for goal: ${goal.name}.`;
            } else if (oldPct < 1.0 && newPct >= 1.0) {
                alertMsg = `Congratulations! You have fully funded your goal: ${goal.name}!`;
            }

            if (alertMsg) {
                await run(
                    'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
                    [session.userId, 'success', 'Goal Milestone Reached', alertMsg]
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Goals error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const id = body.id;

        if (!id || typeof id !== 'number') {
            return NextResponse.json({ error: 'Valid goal ID is required' }, { status: 400 });
        }

        await run('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [id, session.userId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Goals error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
