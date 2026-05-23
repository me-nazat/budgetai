import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, queryOne, run } from '@/lib/db';
import { maybeCreateBudgetAlert } from '@/lib/alerts';

/**
 * POST /api/chat/save — Save AI-processed data from client-side Puter.js AI
 * Also handles edit/delete/reset actions
 */
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            userMessage,
            aiMessage,
            financialData = [],
            actions = [],
            mode = 'chat',
            sessionId,
            isReportRequest,
            reportType,
            dateRange,
        } = await request.json();

        const chatSessionId = sessionId || `session_${Date.now()}`;
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Store user message
        if (userMessage) {
            await run(
                'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
                [session.userId, 'user', userMessage, mode, chatSessionId]
            );
        }

        // ===== EXECUTE DATA MANIPULATION ACTIONS =====
        interface ActionResult { action: string; target: string; count: number; detail: string; }
        const actionResults: ActionResult[] = [];

        for (const action of actions) {
            try {
                if (action.type === 'reset') {
                    const targets = action.target === 'all'
                        ? ['transactions', 'budgets', 'networth', 'notifications', 'chat_history']
                        : [action.target];
                    let totalDeleted = 0;
                    for (const t of targets) {
                        const tableMap: Record<string, string> = { transactions: 'transactions', budgets: 'budgets', networth: 'net_worth', notifications: 'notifications', chat_history: 'chat_messages' };
                        const table = tableMap[t];
                        if (table) totalDeleted += (await run(`DELETE FROM ${table} WHERE user_id = ?`, [session.userId])).rowsAffected;
                    }
                    actionResults.push({ action: 'reset', target: action.target, count: totalDeleted, detail: action.target === 'all' ? `Cleared all data (${totalDeleted} records)` : `Cleared ${action.target} (${totalDeleted} records)` });

                } else if (action.type === 'delete') {
                    const f = action.filter || {};
                    let count = 0;

                    if (action.target === 'transactions') {
                        if (f.id) { count = (await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [f.id, session.userId])).rowsAffected; }
                        else if (f.ids?.length) { for (const id of f.ids) count += (await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, session.userId])).rowsAffected; }
                        else {
                            const conds = ['user_id = ?']; const params: unknown[] = [session.userId];
                            if (f.category) { conds.push('LOWER(category) = LOWER(?)'); params.push(f.category); }
                            if (f.description) { conds.push('LOWER(description) LIKE LOWER(?)'); params.push(`%${f.description}%`); }
                            if (f.date) { conds.push('date = ?'); params.push(f.date); }
                            if (f.dateFrom) { conds.push('date >= ?'); params.push(f.dateFrom); }
                            if (f.dateTo) { conds.push('date <= ?'); params.push(f.dateTo); }
                            if (f.transactionType) { conds.push('type = ?'); params.push(f.transactionType); }
                            count = (await run(`DELETE FROM transactions WHERE ${conds.join(' AND ')}`, params)).rowsAffected;
                        }
                    } else if (action.target === 'budgets') {
                        if (f.id) count = (await run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [f.id, session.userId])).rowsAffected;
                        else if (f.category) count = (await run('DELETE FROM budgets WHERE user_id = ? AND LOWER(category) = LOWER(?) AND month = ? AND year = ?', [session.userId, f.category, currentMonth, currentYear])).rowsAffected;
                        else count = (await run('DELETE FROM budgets WHERE user_id = ? AND month = ? AND year = ?', [session.userId, currentMonth, currentYear])).rowsAffected;
                    } else if (action.target === 'networth') {
                        if (f.id) count = (await run('DELETE FROM net_worth WHERE id = ? AND user_id = ?', [f.id, session.userId])).rowsAffected;
                        else count = (await run('DELETE FROM net_worth WHERE user_id = ?', [session.userId])).rowsAffected;
                    } else if (action.target === 'notifications') {
                        count = (await run('DELETE FROM notifications WHERE user_id = ?', [session.userId])).rowsAffected;
                    } else if (action.target === 'chat_history') {
                        count = (await run('DELETE FROM chat_messages WHERE user_id = ?', [session.userId])).rowsAffected;
                    }
                    actionResults.push({ action: 'delete', target: action.target, count, detail: `Deleted ${count} ${action.target} record${count !== 1 ? 's' : ''}` });

                } else if (action.type === 'edit') {
                    const f = action.filter || {};
                    const u = action.updates || {};
                    let count = 0;

                    if (action.target === 'transactions') {
                        const sets: string[] = []; const sp: unknown[] = [];
                        if (u.amount != null) { sets.push('amount = ?'); sp.push(u.amount); }
                        if (u.category) { sets.push('category = ?'); sp.push(u.category); }
                        if (u.description) { sets.push('description = ?'); sp.push(u.description); }
                        if (u.date) { sets.push('date = ?'); sp.push(u.date); }
                        if (u.type) { sets.push('type = ?'); sp.push(u.type); }
                        if (sets.length > 0) {
                            const conds = ['user_id = ?']; const wp: unknown[] = [session.userId];
                            if (f.id) { conds.push('id = ?'); wp.push(f.id); }
                            else {
                                if (f.category) { conds.push('LOWER(category) = LOWER(?)'); wp.push(f.category); }
                                if (f.description) { conds.push('LOWER(description) LIKE LOWER(?)'); wp.push(`%${f.description}%`); }
                                if (f.date) { conds.push('date = ?'); wp.push(f.date); }
                                if (f.transactionType) { conds.push('type = ?'); wp.push(f.transactionType); }
                            }
                            count = (await run(`UPDATE transactions SET ${sets.join(', ')} WHERE ${conds.join(' AND ')}`, [...sp, ...wp])).rowsAffected;
                        }
                    } else if (action.target === 'budgets') {
                        const sets: string[] = []; const sp: unknown[] = [];
                        if (u.monthly_limit != null) { sets.push('monthly_limit = ?'); sp.push(u.monthly_limit); }
                        if (u.category) { sets.push('category = ?'); sp.push(u.category); }
                        if (sets.length > 0) {
                            const conds = ['user_id = ?']; const wp: unknown[] = [session.userId];
                            if (f.id) { conds.push('id = ?'); wp.push(f.id); }
                            else if (f.category) { conds.push('LOWER(category) = LOWER(?)'); wp.push(f.category); conds.push('month = ?'); wp.push(currentMonth); conds.push('year = ?'); wp.push(currentYear); }
                            count = (await run(`UPDATE budgets SET ${sets.join(', ')} WHERE ${conds.join(' AND ')}`, [...sp, ...wp])).rowsAffected;
                        }
                    } else if (action.target === 'networth') {
                        const sets: string[] = []; const sp: unknown[] = [];
                        if (u.amount != null) { sets.push('amount = ?'); sp.push(u.amount); }
                        if (u.note) { sets.push('note = ?'); sp.push(u.note); }
                        if (sets.length > 0) {
                            if (f.id) { count = (await run(`UPDATE net_worth SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...sp, f.id, session.userId])).rowsAffected; }
                            else {
                                const latest = await queryOne<{ id: number }>('SELECT id FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [session.userId]);
                                if (latest) count = (await run(`UPDATE net_worth SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...sp, latest.id, session.userId])).rowsAffected;
                            }
                        }
                    }
                    actionResults.push({ action: 'edit', target: action.target, count, detail: `Updated ${count} ${action.target} record${count !== 1 ? 's' : ''}` });
                }
            } catch (err) {
                console.error('Action error:', err);
                actionResults.push({ action: action.type, target: action.target, count: 0, detail: `Failed to ${action.type} ${action.target}` });
            }
        }

        // Store new financial entries
        const storedTransactions: Array<{ id: number; type: string; amount: number; category: string; description: string; date: string }> = [];

        for (const entry of financialData) {
            const result = await run(
                'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
                [session.userId, entry.type, entry.amount, entry.category, entry.description, entry.date || today]
            );
            storedTransactions.push({ id: result.lastInsertRowid, ...entry, date: entry.date || today });

            if (entry.type === 'expense') {
                await maybeCreateBudgetAlert({
                    userId: session.userId,
                    type: entry.type,
                    amount: entry.amount,
                    category: entry.category,
                    date: entry.date || today,
                });
            }
        }

        // Store AI response
        if (aiMessage && mode === 'chat') {
            await run('INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
                [session.userId, 'assistant', aiMessage, mode, chatSessionId]);
        }

        return NextResponse.json({
            message: aiMessage || '',
            transactions: storedTransactions,
            actionResults,
            isReportRequest,
            reportType,
            dateRange,
            sessionId: chatSessionId,
            mode,
        });
    } catch (error) {
        console.error('Chat save error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * GET /api/chat/save — Get user's financial context for client-side AI
 */
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const firstOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

        const transactions = await queryAll<{ id: number; type: string; amount: number; category: string; description: string; date: string }>(
            'SELECT id, type, amount, category, description, date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 30',
            [session.userId]
        );

        const netWorthEntry = await queryOne<{ amount: number }>(
            'SELECT amount FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [session.userId]
        );

        const budgets = await queryAll<{ id: number; category: string; monthly_limit: number }>(
            'SELECT id, category, monthly_limit FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
            [session.userId, currentMonth, currentYear]
        );

        const netWorthEntries = await queryAll<{ id: number; amount: number; note: string; created_at: string }>(
            'SELECT id, amount, note, created_at FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
            [session.userId]
        );

        // Build context strings
        const totalExpenses = transactions.filter(t => t.type === 'expense' && t.date >= firstOfMonth).reduce((s, t) => s + t.amount, 0);
        const totalEarnings = transactions.filter(t => t.type === 'earning' && t.date >= firstOfMonth).reduce((s, t) => s + t.amount, 0);

        let context = `Recent financial summary:\n- Expenses (this month): $${totalExpenses.toFixed(2)}\n- Earnings (this month): $${totalEarnings.toFixed(2)}\n- Net: $${(totalEarnings - totalExpenses).toFixed(2)}\n`;
        if (netWorthEntry) context += `- Net worth: $${netWorthEntry.amount.toFixed(2)}\n`;

        if (transactions.length > 0) {
            context += '\nTransactions (with IDs):\n';
            transactions.forEach(t => { context += `- [ID:${t.id}] ${t.date}: ${t.type === 'expense' ? '-' : '+'}$${t.amount} (${t.category}) - ${t.description}\n`; });
        }
        if (budgets.length > 0) {
            context += '\nBudgets (with IDs):\n';
            budgets.forEach(b => { context += `- [ID:${b.id}] ${b.category}: limit $${b.monthly_limit}\n`; });
        }
        if (netWorthEntries.length > 0) {
            context += '\nNet worth entries (with IDs):\n';
            netWorthEntries.forEach(n => { context += `- [ID:${n.id}] $${n.amount} - ${n.note || 'no note'}\n`; });
        }

        const budgetWithSpending = budgets.map(b => {
            const spent = transactions.filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && t.date >= firstOfMonth).reduce((s, t) => s + t.amount, 0);
            const pct = b.monthly_limit > 0 ? ((spent / b.monthly_limit) * 100).toFixed(0) : '0';
            return `${b.category}: $${spent.toFixed(2)} / $${b.monthly_limit.toFixed(2)} (${pct}%)`;
        });

        const budgetContext = budgetWithSpending.length > 0
            ? 'Monthly budget limits:\n' + budgetWithSpending.map(b => `- ${b}`).join('\n')
            : 'No budget limits set.';

        return NextResponse.json({
            context,
            budgetContext,
            today: new Date().toISOString().split('T')[0],
        });
    } catch (error) {
        console.error('Context fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
