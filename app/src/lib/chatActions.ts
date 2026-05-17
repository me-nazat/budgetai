import { DataAction, ParsedFinancialData } from '@/lib/ai';
import { queryOne, run } from '@/lib/db';
import { maybeCreateBudgetAlert } from '@/lib/alerts';

export interface ActionResult {
    action: string;
    target: string;
    count: number;
    detail: string;
}

export interface StoredTransaction {
    id: number;
    type: string;
    amount: number;
    category: string;
    description: string;
    date: string;
}

export async function processDataActions(actions: DataAction[], userId: number): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    for (const action of actions) {
        try {
            if (action.type === 'reset') {
                const targets = action.target === 'all'
                    ? ['transactions', 'budgets', 'networth', 'notifications', 'chat_history'] as const
                    : [action.target] as const;

                let totalDeleted = 0;
                for (const target of targets) {
                    const tableMap: Record<string, string> = {
                        transactions: 'transactions',
                        budgets: 'budgets',
                        networth: 'net_worth',
                        notifications: 'notifications',
                        chat_history: 'chat_messages',
                    };
                    const table = tableMap[target];
                    if (table) totalDeleted += (await run(`DELETE FROM ${table} WHERE user_id = ?`, [userId])).rowsAffected;
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
                const count = await executeDelete(action, userId, currentMonth, currentYear);
                results.push({
                    action: 'delete',
                    target: action.target,
                    count,
                    detail: `Deleted ${count} ${action.target} record${count !== 1 ? 's' : ''}`,
                });
            } else if (action.type === 'edit') {
                const count = await executeEdit(action, userId, currentMonth, currentYear);
                results.push({
                    action: 'edit',
                    target: action.target,
                    count,
                    detail: `Updated ${count} ${action.target} record${count !== 1 ? 's' : ''}`,
                });
            }
        } catch (error) {
            console.error('Action error:', action, error);
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
        if (f.id) return (await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [f.id, userId])).rowsAffected;
        if (f.ids && f.ids.length > 0) {
            let total = 0;
            for (const id of f.ids) total += (await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId])).rowsAffected;
            return total;
        }

        const conditions = ['user_id = ?'];
        const params: unknown[] = [userId];
        if (f.category) { conditions.push('LOWER(category) = LOWER(?)'); params.push(f.category); }
        if (f.description) { conditions.push('LOWER(description) LIKE LOWER(?)'); params.push(`%${f.description}%`); }
        if (f.date) { conditions.push('date = ?'); params.push(f.date); }
        if (f.dateFrom) { conditions.push('date >= ?'); params.push(f.dateFrom); }
        if (f.dateTo) { conditions.push('date <= ?'); params.push(f.dateTo); }
        if (f.transactionType) { conditions.push('type = ?'); params.push(f.transactionType); }
        return (await run(`DELETE FROM transactions WHERE ${conditions.join(' AND ')}`, params)).rowsAffected;
    }

    if (action.target === 'budgets') {
        if (f.id) return (await run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [f.id, userId])).rowsAffected;
        if (f.category) {
            return (await run(
                'DELETE FROM budgets WHERE user_id = ? AND LOWER(category) = LOWER(?) AND month = ? AND year = ?',
                [userId, f.category, currentMonth, currentYear]
            )).rowsAffected;
        }
        return (await run('DELETE FROM budgets WHERE user_id = ? AND month = ? AND year = ?', [userId, currentMonth, currentYear])).rowsAffected;
    }

    if (action.target === 'networth') {
        if (f.id) return (await run('DELETE FROM net_worth WHERE id = ? AND user_id = ?', [f.id, userId])).rowsAffected;
        return (await run('DELETE FROM net_worth WHERE user_id = ?', [userId])).rowsAffected;
    }

    if (action.target === 'notifications') {
        if (f.id) return (await run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [f.id, userId])).rowsAffected;
        return (await run('DELETE FROM notifications WHERE user_id = ?', [userId])).rowsAffected;
    }

    if (action.target === 'chat_history') {
        return (await run('DELETE FROM chat_messages WHERE user_id = ?', [userId])).rowsAffected;
    }

    return 0;
}

async function executeEdit(action: DataAction, userId: number, currentMonth: number, currentYear: number): Promise<number> {
    const f = action.filter || {};
    const u = action.updates || {};

    if (action.target === 'transactions') {
        const sets: string[] = [];
        const setParams: unknown[] = [];
        if (u.amount !== undefined && u.amount !== null) { sets.push('amount = ?'); setParams.push(u.amount); }
        if (u.category) { sets.push('category = ?'); setParams.push(u.category); }
        if (u.description) { sets.push('description = ?'); setParams.push(u.description); }
        if (u.date) { sets.push('date = ?'); setParams.push(u.date); }
        if (u.type) { sets.push('type = ?'); setParams.push(u.type); }
        if (sets.length === 0) return 0;

        const conditions = ['user_id = ?'];
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

        const result = await run(`UPDATE transactions SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')}`, [...setParams, ...whereParams]);
        if (result.rowsAffected > 0 && (u.type === 'expense' || (!u.type && action.target === 'transactions'))) {
            await maybeCreateBudgetAlert({
                userId,
                type: u.type || 'expense',
                category: u.category || f.category || '',
                date: u.date || f.date || new Date().toISOString().split('T')[0],
            });
        }
        return result.rowsAffected;
    }

    if (action.target === 'budgets') {
        const sets: string[] = [];
        const setParams: unknown[] = [];
        if (u.monthly_limit !== undefined && u.monthly_limit !== null) { sets.push('monthly_limit = ?'); setParams.push(u.monthly_limit); }
        if (u.category) { sets.push('category = ?'); setParams.push(u.category); }
        if (sets.length === 0) return 0;

        const conditions = ['user_id = ?'];
        const whereParams: unknown[] = [userId];
        if (f.id) { conditions.push('id = ?'); whereParams.push(f.id); }
        else if (f.category) {
            conditions.push('LOWER(category) = LOWER(?)'); whereParams.push(f.category);
            conditions.push('month = ?'); whereParams.push(currentMonth);
            conditions.push('year = ?'); whereParams.push(currentYear);
        }
        return (await run(`UPDATE budgets SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')}`, [...setParams, ...whereParams])).rowsAffected;
    }

    if (action.target === 'networth') {
        const sets: string[] = [];
        const setParams: unknown[] = [];
        if (u.amount !== undefined && u.amount !== null) { sets.push('amount = ?'); setParams.push(u.amount); }
        if (u.note) { sets.push('note = ?'); setParams.push(u.note); }
        if (sets.length === 0) return 0;
        if (f.id) return (await run(`UPDATE net_worth SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...setParams, f.id, userId])).rowsAffected;

        const latest = await queryOne<{ id: number }>('SELECT id FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
        if (!latest) return 0;
        return (await run(`UPDATE net_worth SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...setParams, latest.id, userId])).rowsAffected;
    }

    return 0;
}

export async function storeFinancialData(
    financialData: ParsedFinancialData[],
    userId: number,
    today: string,
    currencySymbol = '$'
): Promise<StoredTransaction[]> {
    const stored: StoredTransaction[] = [];

    for (const entry of financialData) {
        const date = entry.date || today;
        const result = await run(
            'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, entry.type, entry.amount, entry.category, entry.description, date]
        );

        const transaction = { id: result.lastInsertRowid, ...entry, date };
        stored.push(transaction);
        await maybeCreateBudgetAlert({
            userId,
            type: entry.type,
            amount: entry.amount,
            category: entry.category,
            date,
            currencySymbol,
        });
    }

    return stored;
}

