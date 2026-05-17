import { queryOne, run } from '@/lib/db';

interface BudgetAlertInput {
    userId: number;
    type: string;
    amount?: number;
    category: string;
    date: string;
    currencySymbol?: string;
}

function monthBounds(date: string) {
    const [year, month] = date.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const next = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    return { year, month, start, next, label: `${year}-${String(month).padStart(2, '0')}` };
}

export async function maybeCreateBudgetAlert({
    userId,
    type,
    category,
    date,
    currencySymbol = '$',
}: BudgetAlertInput): Promise<void> {
    if (type !== 'expense' || !category || !date) return;

    const { year, month, start, next, label } = monthBounds(date);

    const [profile, budget] = await Promise.all([
        queryOne<{ notify_budget: number; notify_overspend: number }>(
            'SELECT notify_budget, notify_overspend FROM users WHERE id = ?',
            [userId]
        ),
        queryOne<{ monthly_limit: number; category: string }>(
            'SELECT monthly_limit, category FROM budgets WHERE user_id = ? AND LOWER(category) = LOWER(?) AND month = ? AND year = ?',
            [userId, category, month, year]
        ),
    ]);

    if (!budget || budget.monthly_limit <= 0) return;

    const spent = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ? AND type = 'expense' AND LOWER(category) = LOWER(?) AND date >= ? AND date < ?`,
        [userId, budget.category, start, next]
    );

    const currentSpent = spent?.total || 0;
    const percentage = (currentSpent / budget.monthly_limit) * 100;
    if (percentage < 80) return;

    const isOver = percentage >= 100;
    if (isOver && profile?.notify_overspend === 0) return;
    if (!isOver && profile?.notify_budget === 0) return;

    const notificationType = isOver ? 'danger' : 'warning';
    const title = isOver ? `Over Budget: ${budget.category}` : `Budget Warning: ${budget.category}`;
    const remaining = Math.max(0, budget.monthly_limit - currentSpent);
    const message = isOver
        ? `You've exceeded your ${currencySymbol}${budget.monthly_limit.toFixed(2)} budget for ${budget.category} in ${label}. Current spending: ${currencySymbol}${currentSpent.toFixed(2)}.`
        : `You've used ${percentage.toFixed(0)}% of your ${currencySymbol}${budget.monthly_limit.toFixed(2)} budget for ${budget.category} in ${label}. Remaining: ${currencySymbol}${remaining.toFixed(2)}.`;

    const duplicate = await queryOne<{ id: number }>(
        'SELECT id FROM notifications WHERE user_id = ? AND title = ? AND message LIKE ? LIMIT 1',
        [userId, title, `%${label}%`]
    );

    if (duplicate) return;

    await run(
        'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
        [userId, notificationType, title, message]
    );
}

