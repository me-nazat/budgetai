import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryAll, queryOne, run } from '@/lib/db';
import { processMessage, buildContext, buildBudgetContext, DataAction } from '@/lib/ai';

interface ActionResult {
    action: string;
    target: string;
    count: number;
    detail: string;
}

// ===========================================
// ACTION PROCESSOR — Executes AI data actions
// ===========================================
async function processActions(actions: DataAction[], userId: number): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    for (const action of actions) {
        try {
            if (action.type === 'reset') {
                // ===== RESET / CLEAR =====
                const targets = action.target === 'all'
                    ? ['transactions', 'budgets', 'networth', 'notifications', 'chat_history'] as const
                    : [action.target] as const;

                let totalDeleted = 0;
                for (const t of targets) {
                    let table = '';
                    switch (t) {
                        case 'transactions': table = 'transactions'; break;
                        case 'budgets': table = 'budgets'; break;
                        case 'networth': table = 'net_worth'; break;
                        case 'notifications': table = 'notifications'; break;
                        case 'chat_history': table = 'chat_messages'; break;
                    }
                    if (table) {
                        const r = await run(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
                        totalDeleted += r.rowsAffected;
                    }
                }
                results.push({
                    action: 'reset',
                    target: action.target,
                    count: totalDeleted,
                    detail: action.target === 'all'
                        ? `Cleared all data (${totalDeleted} records removed)`
                        : `Cleared ${action.target} (${totalDeleted} records removed)`,
                });

            } else if (action.type === 'delete') {
                // ===== DELETE =====
                const count = await executeDelete(action, userId, currentMonth, currentYear);
                results.push({
                    action: 'delete',
                    target: action.target,
                    count,
                    detail: `Deleted ${count} ${action.target} record${count !== 1 ? 's' : ''}`,
                });

            } else if (action.type === 'edit') {
                // ===== EDIT =====
                const count = await executeEdit(action, userId, currentMonth, currentYear);
                results.push({
                    action: 'edit',
                    target: action.target,
                    count,
                    detail: `Updated ${count} ${action.target} record${count !== 1 ? 's' : ''}`,
                });
            }
        } catch (err) {
            console.error('Action error:', action, err);
            results.push({
                action: action.type,
                target: action.target,
                count: 0,
                detail: `Failed to ${action.type} ${action.target}`,
            });
        }
    }

    return results;
}

async function executeDelete(action: DataAction, userId: number, currentMonth: number, currentYear: number): Promise<number> {
    const f = action.filter || {};

    if (action.target === 'transactions') {
        // Delete by ID
        if (f.id) {
            return (await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [f.id, userId])).rowsAffected;
        }
        if (f.ids && f.ids.length > 0) {
            let total = 0;
            for (const id of f.ids) {
                total += (await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId])).rowsAffected;
            }
            return total;
        }

        // Delete by filters
        const conditions: string[] = ['user_id = ?'];
        const params: unknown[] = [userId];

        if (f.category) { conditions.push('LOWER(category) = LOWER(?)'); params.push(f.category); }
        if (f.description) { conditions.push('LOWER(description) LIKE LOWER(?)'); params.push(`%${f.description}%`); }
        if (f.date) { conditions.push('date = ?'); params.push(f.date); }
        if (f.dateFrom) { conditions.push('date >= ?'); params.push(f.dateFrom); }
        if (f.dateTo) { conditions.push('date <= ?'); params.push(f.dateTo); }
        if (f.transactionType) { conditions.push('type = ?'); params.push(f.transactionType); }

        return (await run(`DELETE FROM transactions WHERE ${conditions.join(' AND ')}`, params)).rowsAffected;

    } else if (action.target === 'budgets') {
        if (f.id) {
            return (await run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [f.id, userId])).rowsAffected;
        }
        if (f.category) {
            return (await run('DELETE FROM budgets WHERE user_id = ? AND LOWER(category) = LOWER(?) AND month = ? AND year = ?',
                [userId, f.category, currentMonth, currentYear])).rowsAffected;
        }
        return (await run('DELETE FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
            [userId, currentMonth, currentYear])).rowsAffected;

    } else if (action.target === 'networth') {
        if (f.id) {
            return (await run('DELETE FROM net_worth WHERE id = ? AND user_id = ?', [f.id, userId])).rowsAffected;
        }
        return (await run('DELETE FROM net_worth WHERE user_id = ?', [userId])).rowsAffected;

    } else if (action.target === 'notifications') {
        if (f.id) {
            return (await run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [f.id, userId])).rowsAffected;
        }
        return (await run('DELETE FROM notifications WHERE user_id = ?', [userId])).rowsAffected;

    } else if (action.target === 'chat_history') {
        return (await run('DELETE FROM chat_messages WHERE user_id = ?', [userId])).rowsAffected;
    }

    return 0;
}

async function executeEdit(action: DataAction, userId: number, currentMonth: number, currentYear: number): Promise<number> {
    const f = action.filter || {};
    const u = action.updates || {};

    if (action.target === 'transactions') {
        // Build SET clause
        const sets: string[] = [];
        const setParams: unknown[] = [];

        if (u.amount !== undefined && u.amount !== null) { sets.push('amount = ?'); setParams.push(u.amount); }
        if (u.category) { sets.push('category = ?'); setParams.push(u.category); }
        if (u.description) { sets.push('description = ?'); setParams.push(u.description); }
        if (u.date) { sets.push('date = ?'); setParams.push(u.date); }
        if (u.type) { sets.push('type = ?'); setParams.push(u.type); }

        if (sets.length === 0) return 0;

        // Build WHERE clause
        const conditions: string[] = ['user_id = ?'];
        const whereParams: unknown[] = [userId];

        if (f.id) { conditions.push('id = ?'); whereParams.push(f.id); }
        else {
            if (f.category) { conditions.push('LOWER(category) = LOWER(?)'); whereParams.push(f.category); }
            if (f.description) { conditions.push('LOWER(description) LIKE LOWER(?)'); whereParams.push(`%${f.description}%`); }
            if (f.date) { conditions.push('date = ?'); whereParams.push(f.date); }
            if (f.dateFrom) { conditions.push('date >= ?'); whereParams.push(f.dateFrom); }
            if (f.dateTo) { conditions.push('date <= ?'); whereParams.push(f.dateTo); }
            if (f.transactionType) { conditions.push('type = ?'); whereParams.push(f.transactionType); }
        }

        return (await run(
            `UPDATE transactions SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')}`,
            [...setParams, ...whereParams]
        )).rowsAffected;

    } else if (action.target === 'budgets') {
        const sets: string[] = [];
        const setParams: unknown[] = [];

        if (u.monthly_limit !== undefined && u.monthly_limit !== null) { sets.push('monthly_limit = ?'); setParams.push(u.monthly_limit); }
        if (u.category) { sets.push('category = ?'); setParams.push(u.category); }

        if (sets.length === 0) return 0;

        const conditions: string[] = ['user_id = ?'];
        const whereParams: unknown[] = [userId];

        if (f.id) { conditions.push('id = ?'); whereParams.push(f.id); }
        else if (f.category) {
            conditions.push('LOWER(category) = LOWER(?)'); whereParams.push(f.category);
            conditions.push('month = ?'); whereParams.push(currentMonth);
            conditions.push('year = ?'); whereParams.push(currentYear);
        }

        return (await run(
            `UPDATE budgets SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')}`,
            [...setParams, ...whereParams]
        )).rowsAffected;

    } else if (action.target === 'networth') {
        const sets: string[] = [];
        const setParams: unknown[] = [];

        if (u.amount !== undefined && u.amount !== null) { sets.push('amount = ?'); setParams.push(u.amount); }
        if (u.note) { sets.push('note = ?'); setParams.push(u.note); }

        if (sets.length === 0) return 0;

        if (f.id) {
            return (await run(`UPDATE net_worth SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...setParams, f.id, userId])).rowsAffected;
        }
        // Update most recent
        const latest = await queryOne<{ id: number }>('SELECT id FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
        if (latest) {
            return (await run(`UPDATE net_worth SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...setParams, latest.id, userId])).rowsAffected;
        }
        return 0;
    }

    return 0;
}

// ===========================================
// MAIN CHAT HANDLER
// ===========================================
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, mode = 'chat', sessionId } = await request.json();
        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const chatSessionId = sessionId || `session_${Date.now()}`;
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Store user message
        await run(
            'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
            [session.userId, 'user', message, mode, chatSessionId]
        );

        // ===== OPTIMIZED: Parallel DB queries via Promise.all =====
        const firstOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

        const [transactions, allTransactions, netWorthEntry, budgets, netWorthEntries, savingsGoals, recurringTx, chatHistory, userProfile] = await Promise.all([
            queryAll<{ id: number; type: string; amount: number; category: string; description: string; date: string }>(
                'SELECT id, type, amount, category, description, date FROM transactions WHERE user_id = ? AND date >= ? ORDER BY date DESC LIMIT 50',
                [session.userId, firstOfMonth]
            ),
            queryAll<{ id: number; type: string; amount: number; category: string; description: string; date: string }>(
                'SELECT id, type, amount, category, description, date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 100',
                [session.userId]
            ),
            queryOne<{ amount: number }>(
                'SELECT amount FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                [session.userId]
            ),
            queryAll<{ id: number; category: string; monthly_limit: number }>(
                'SELECT id, category, monthly_limit FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
                [session.userId, currentMonth, currentYear]
            ),
            queryAll<{ id: number; amount: number; note: string; created_at: string }>(
                'SELECT id, amount, note, created_at FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
                [session.userId]
            ),
            queryAll<{ id: number; name: string; target_amount: number; saved_amount: number; deadline: string | null }>(
                'SELECT id, name, target_amount, saved_amount, deadline FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC',
                [session.userId]
            ),
            queryAll<{ id: number; name: string; type: string; amount: number; category: string; frequency: string; next_date: string }>(
                'SELECT id, name, type, amount, category, frequency, next_date FROM recurring_transactions WHERE user_id = ? AND active = 1',
                [session.userId]
            ),
            queryAll<{ role: string; content: string }>(
                'SELECT role, content FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 6',
                [session.userId, chatSessionId]
            ),
            queryOne<{ name: string; currency: string }>(
                'SELECT name, currency FROM users WHERE id = ?',
                [session.userId]
            ),
        ]);

        const budgetWithSpending = budgets.map(b => {
            const spent = transactions
                .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
                .reduce((sum, t) => sum + t.amount, 0);
            return { ...b, spent };
        });

        const context = buildContext(transactions, netWorthEntry?.amount, allTransactions, budgets, netWorthEntries, savingsGoals, recurringTx, userProfile?.name, userProfile?.currency);
        const budgetContext = buildBudgetContext(budgetWithSpending, userProfile?.currency);

        // Multi-turn conversation context
        const historyContext = chatHistory.length > 1
            ? '\n\nRecent conversation:\n' + [...chatHistory].reverse().slice(0, -1).map(m => `${m.role}: ${m.content.substring(0, 200)}`).join('\n')
            : '';

        // Process with AI
        const aiResponse = await processMessage(message + historyContext, context, budgetContext, today, userProfile ? { name: userProfile.name, currency: userProfile.currency } : undefined);

        // ===== EXECUTE DATA MANIPULATION ACTIONS =====
        let actionResults: ActionResult[] = [];
        if (aiResponse.actions && aiResponse.actions.length > 0) {
            actionResults = await processActions(aiResponse.actions, session.userId);
        }

        // Store financial data extracted by AI (new entries)
        const storedTransactions: Array<{ id: number; type: string; amount: number; category: string; description: string; date: string }> = [];

        for (const entry of aiResponse.financialData) {
            const result = await run(
                'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
                [session.userId, entry.type, entry.amount, entry.category, entry.description, entry.date || today]
            );
            storedTransactions.push({
                id: result.lastInsertRowid,
                ...entry,
                date: entry.date || today,
            });

            // Check budget alerts
            if (entry.type === 'expense') {
                const budget = budgetWithSpending.find(b => b.category.toLowerCase() === entry.category.toLowerCase());
                if (budget) {
                    const newSpent = budget.spent + entry.amount;
                    const pct = (newSpent / budget.monthly_limit) * 100;
                    if (pct >= 100) {
                        await run(
                            'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
                            [session.userId, 'danger', `Over Budget: ${entry.category}`, `You've exceeded your $${budget.monthly_limit} budget for ${entry.category}. Current spending: $${newSpent.toFixed(2)}`]
                        );
                    } else if (pct >= 80) {
                        await run(
                            'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
                            [session.userId, 'warning', `Budget Warning: ${entry.category}`, `You've used ${pct.toFixed(0)}% of your $${budget.monthly_limit} budget for ${entry.category}. Remaining: $${(budget.monthly_limit - newSpent).toFixed(2)}`]
                        );
                    }
                }
            }
        }

        // Store AI response
        let aiMessage = '';
        if (mode === 'chat') {
            aiMessage = aiResponse.message;
            await run(
                'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
                [session.userId, 'assistant', aiMessage, mode, chatSessionId]
            );
        } else {
            if (storedTransactions.length > 0 || actionResults.length > 0) {
                const parts: string[] = [];
                if (storedTransactions.length > 0) {
                    parts.push(storedTransactions.map(t => `${t.type}: $${t.amount} (${t.category})`).join(', '));
                }
                if (actionResults.length > 0) {
                    parts.push(actionResults.map(r => r.detail).join(', '));
                }
                aiMessage = `✓ ${parts.join(' | ')}`;
                await run(
                    'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
                    [session.userId, 'system', aiMessage, mode, chatSessionId]
                );
            }
        }

        return NextResponse.json({
            message: mode === 'chat' ? aiMessage : (storedTransactions.length > 0 || actionResults.length > 0 ? aiMessage : ''),
            transactions: storedTransactions,
            actionResults,
            isReportRequest: aiResponse.isReportRequest,
            reportType: aiResponse.reportType,
            dateRange: aiResponse.dateRange,
            sessionId: chatSessionId,
            mode,
        });
    } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
