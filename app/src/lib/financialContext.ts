import { buildBudgetContext, buildContext } from '@/lib/ai';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';
import { queryAll, queryOne } from '@/lib/db';

export interface FinancialContextBundle {
    context: string;
    budgetContext: string;
    historyContext: string;
    profile?: {
        name: string;
        currency: string;
        notify_budget: number;
        notify_overspend: number;
    };
    currencySymbol: string;
}

function monthBounds(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    return { year, month, firstOfMonth, nextMonth };
}

function buildFinancialMemory(args: {
    transactions: Array<{ type: string; amount: number; category: string; description: string; date: string }>;
    budgets: Array<{ category: string; monthly_limit: number; spent: number }>;
    goals: Array<{ name: string; target_amount: number; saved_amount: number; deadline: string | null }>;
    recurring: Array<{ name: string; type: string; amount: number; category: string; frequency: string; next_date: string }>;
    notifications: Array<{ title: string; message: string; type: string; read: number }>;
    customCategories: Array<{ name: string; type: string }>;
    currencySymbol: string;
}) {
    const { transactions, budgets, goals, recurring, notifications, customCategories, currencySymbol } = args;
    const expenses = transactions.filter(t => t.type === 'expense');
    const earnings = transactions.filter(t => t.type === 'earning');
    const expenseTotal = expenses.reduce((sum, t) => sum + t.amount, 0);
    const earningTotal = earnings.reduce((sum, t) => sum + t.amount, 0);
    const topCategories = Object.entries(expenses.reduce<Record<string, number>>((map, tx) => {
        map[tx.category] = (map[tx.category] || 0) + tx.amount;
        return map;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const activeGoalCount = goals.filter(g => g.saved_amount < g.target_amount).length;
    const riskBudgets = budgets.filter(b => b.monthly_limit > 0 && b.spent / b.monthly_limit >= 0.8);
    const unreadAlerts = notifications.filter(n => !n.read).length;

    let memory = '\nFinancial memory and behavior profile:\n';
    memory += `- Current-month tracked income: ${currencySymbol}${earningTotal.toFixed(2)}; expenses: ${currencySymbol}${expenseTotal.toFixed(2)}; net: ${currencySymbol}${(earningTotal - expenseTotal).toFixed(2)}.\n`;
    if (topCategories.length > 0) {
        memory += `- Strongest spending patterns: ${topCategories.map(([category, total]) => `${category} (${currencySymbol}${total.toFixed(2)})`).join(', ')}.\n`;
    }
    if (riskBudgets.length > 0) {
        memory += `- Budget pressure: ${riskBudgets.map(b => `${b.category} ${Math.round((b.spent / b.monthly_limit) * 100)}% used`).join(', ')}.\n`;
    }
    if (goals.length > 0) {
        const saved = goals.reduce((sum, goal) => sum + goal.saved_amount, 0);
        const target = goals.reduce((sum, goal) => sum + goal.target_amount, 0);
        memory += `- Savings goals: ${activeGoalCount} active; ${currencySymbol}${saved.toFixed(2)} saved toward ${currencySymbol}${target.toFixed(2)} total targets.\n`;
    }
    if (recurring.length > 0) {
        memory += `- Recurring commitments/income: ${recurring.slice(0, 8).map(r => `${r.name} ${r.type === 'expense' ? '-' : '+'}${currencySymbol}${r.amount} ${r.frequency}`).join(', ')}.\n`;
    }
    if (customCategories.length > 0) {
        memory += `- User-defined categories: ${customCategories.slice(0, 12).map(c => `${c.name} (${c.type})`).join(', ')}.\n`;
    }
    if (unreadAlerts > 0) memory += `- Attention needed: ${unreadAlerts} unread alert${unreadAlerts === 1 ? '' : 's'}.\n`;

    return memory;
}

export async function getFinancialContextBundle(userId: number, sessionId?: string): Promise<FinancialContextBundle> {
    const { year, month, firstOfMonth, nextMonth } = monthBounds();

    const [
        currentTransactions,
        allTransactions,
        netWorthEntry,
        budgets,
        netWorthEntries,
        savingsGoals,
        recurringTx,
        chatHistory,
        userProfile,
        notifications,
        customCategories,
        dailyRollup,
        categoryRollup,
    ] = await Promise.all([
        queryAll<{ id: number; type: string; amount: number; category: string; description: string; date: string }>(
            'SELECT id, type, amount, category, description, date FROM transactions WHERE user_id = ? AND date >= ? AND date < ? ORDER BY date DESC LIMIT 120',
            [userId, firstOfMonth, nextMonth]
        ),
        queryAll<{ id: number; type: string; amount: number; category: string; description: string; date: string }>(
            'SELECT id, type, amount, category, description, date FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 300',
            [userId]
        ),
        queryOne<{ amount: number }>(
            'SELECT amount FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        ),
        queryAll<{ id: number; category: string; monthly_limit: number }>(
            'SELECT id, category, monthly_limit FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
            [userId, month, year]
        ),
        queryAll<{ id: number; amount: number; note: string; created_at: string }>(
            'SELECT id, amount, note, created_at FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
            [userId]
        ),
        queryAll<{ id: number; name: string; target_amount: number; saved_amount: number; deadline: string | null }>(
            'SELECT id, name, target_amount, saved_amount, deadline FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        ),
        queryAll<{ id: number; name: string; type: string; amount: number; category: string; frequency: string; next_date: string }>(
            'SELECT id, name, type, amount, category, frequency, next_date FROM recurring_transactions WHERE user_id = ? AND active = 1 ORDER BY next_date ASC',
            [userId]
        ),
        sessionId
            ? queryAll<{ role: string; content: string }>(
                'SELECT role, content FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC LIMIT 10',
                [userId, sessionId]
            )
            : Promise.resolve([]),
        queryOne<{ name: string; currency: string; notify_budget: number; notify_overspend: number }>(
            'SELECT name, currency, notify_budget, notify_overspend FROM users WHERE id = ?',
            [userId]
        ),
        queryAll<{ title: string; message: string; type: string; read: number }>(
            'SELECT title, message, type, read FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [userId]
        ),
        queryAll<{ name: string; type: string }>(
            'SELECT name, type FROM custom_categories WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        ),
        queryAll<{ date: string; expenses: number; earnings: number }>(
            `SELECT date,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
                    COALESCE(SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END), 0) as earnings
             FROM transactions WHERE user_id = ? AND date >= ? AND date < ? GROUP BY date ORDER BY date ASC`,
            [userId, firstOfMonth, nextMonth]
        ),
        queryAll<{ category: string; total: number }>(
            "SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ? GROUP BY category ORDER BY total DESC LIMIT 12",
            [userId, firstOfMonth, nextMonth]
        ),
    ]);

    const currencyCode = userProfile?.currency as CurrencyCode | undefined;
    const currencySymbol = currencyCode && CURRENCIES[currencyCode] ? CURRENCIES[currencyCode].symbol : '$';
    const budgetWithSpending = budgets.map(b => {
        const spent = currentTransactions
            .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
            .reduce((sum, t) => sum + t.amount, 0);
        return { ...b, spent };
    });

    const memory = buildFinancialMemory({
        transactions: currentTransactions,
        budgets: budgetWithSpending,
        goals: savingsGoals,
        recurring: recurringTx,
        notifications,
        customCategories,
        currencySymbol,
    });

    let context = buildContext(
        currentTransactions,
        netWorthEntry?.amount,
        allTransactions,
        budgets,
        netWorthEntries,
        savingsGoals,
        recurringTx,
        userProfile?.name,
        currencySymbol,
    );

    if (notifications.length > 0) {
        context += '\nRecent alerts:\n';
        notifications.slice(0, 8).forEach(n => {
            context += `- [${n.type}] ${n.title}: ${n.message}${n.read ? '' : ' (unread)'}\n`;
        });
    }

    if (dailyRollup.length > 0) {
        context += '\nMy Month daily rollup:\n';
        dailyRollup.forEach(d => {
            context += `- ${d.date}: expenses ${currencySymbol}${d.expenses.toFixed(2)}, earnings ${currencySymbol}${d.earnings.toFixed(2)}\n`;
        });
    }

    if (categoryRollup.length > 0) {
        context += '\nOverview category distribution:\n';
        categoryRollup.forEach(c => {
            context += `- ${c.category}: ${currencySymbol}${c.total.toFixed(2)}\n`;
        });
    }

    context += memory;

    const historyContext = chatHistory.length > 1
        ? '\n\nRecent conversation:\n' + [...chatHistory]
            .reverse()
            .slice(0, -1)
            .map(m => `${m.role}: ${m.content.substring(0, 300)}`)
            .join('\n')
        : '';

    return {
        context,
        budgetContext: buildBudgetContext(budgetWithSpending, currencySymbol),
        historyContext,
        profile: userProfile,
        currencySymbol,
    };
}
