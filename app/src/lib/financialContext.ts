import { buildBudgetContext, buildContext } from '@/lib/ai';
import { CURRENCIES, CurrencyCode } from '@/lib/currency';
import { queryAll, queryOne } from '@/lib/db';

export interface FinancialSnapshot {
    baseCurrency: string;
    activeDate: string;
    activeMonth: number;
    activeYear: number;
    liquidity: {
        liquidCash: number;
        safeToSpend: number;
        dailyAllowance: number;
        emergencyRunwayMonths: number;
    };
    currentMonthCashflow: {
        income: number;
        expenses: number;
        netSavings: number;
        savingsRatePercent: number;
    };
    accountsSummary: Array<{
        id: number;
        name: string;
        type: string;
        currency: string;
        balance: number;
    }>;
    budgetAlerts: Array<{
        category: string;
        spent: number;
        monthlyLimit: number;
        percentUsed: number;
        isOverspent: boolean;
    }>;
    upcomingBillsNext14Days: Array<{
        title: string;
        amount: number;
        dueDate: string;
    }>;
    collaborativeBalances: {
        totalOwedToUser: number;
        totalUserOwes: number;
    };
}

export interface FinancialContextBundle {
    context: string;
    budgetContext: string;
    historyContext: string;
    profile?: {
        name: string;
        currency: string;
        notify_budget: number;
        notify_overspend: number;
        locale?: string;
    };
    currencySymbol: string;
    snapshot: FinancialSnapshot;
}

function monthBounds(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    return { year, month, firstOfMonth, nextMonth, daysInMonth, dayOfMonth: date.getDate() };
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
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split('T')[0];
    const { year, month, firstOfMonth, nextMonth, daysInMonth, dayOfMonth } = monthBounds(todayDate);

    // Compute 14 days ahead for upcoming bills
    const future14 = new Date(todayDate.getTime() + 14 * 86400000);
    const future14Str = future14.toISOString().split('T')[0];

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
        userAccounts,
        userBillSplits,
        userDebts,
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
        queryOne<{ name: string; currency: string; notify_budget: number; notify_overspend: number; locale?: string; preferred_locale?: string }>(
            'SELECT name, currency, notify_budget, notify_overspend, locale, preferred_locale FROM users WHERE id = ?',
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
        queryAll<{ id: number; name: string; type: string; currency: string; current_balance: number }>(
            'SELECT id, name, type, currency, current_balance FROM accounts WHERE user_id = ? AND is_archived = 0',
            [userId]
        ).catch(() => []),
        queryAll<{ id: number; description: string; total_amount: number; participants_json: string }>(
            'SELECT id, description, total_amount, participants_json FROM bill_splits WHERE user_id = ?',
            [userId]
        ).catch(() => []),
        queryAll<{ id: number; name: string; balance: number }>(
            'SELECT id, name, balance FROM debts WHERE user_id = ?',
            [userId]
        ).catch(() => []),
    ]);

    const baseCurrency = userProfile?.currency || 'BDT';
    const currencyCode = userProfile?.currency as CurrencyCode | undefined;
    const currencySymbol = currencyCode && CURRENCIES[currencyCode] ? CURRENCIES[currencyCode].symbol : '$';

    const budgetWithSpending = budgets.map(b => {
        const spent = currentTransactions
            .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
            .reduce((sum, t) => sum + t.amount, 0);
        return { ...b, spent };
    });

    // ── Build Deterministic Pre-calculated Snapshot ──
    const currentMonthExpenses = currentTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    const currentMonthIncome = currentTransactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + t.amount, 0);
    const netSavings = currentMonthIncome - currentMonthExpenses;
    const savingsRatePercent = currentMonthIncome > 0
        ? Math.round((netSavings / currentMonthIncome) * 100)
        : 0;

    // Accounts Summary
    const accountsSummary = (userAccounts || []).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        balance: Number(a.current_balance || 0),
    }));

    // Liquid Cash: Sum balances from cash, bank, and mobile_wallet accounts
    const liquidTypes = new Set(['cash', 'bank', 'mobile_wallet']);
    let liquidCash = accountsSummary
        .filter(a => liquidTypes.has(a.type.toLowerCase()))
        .reduce((sum, a) => sum + a.balance, 0);

    // Fallback if no accounts configured
    if (accountsSummary.length === 0) {
        liquidCash = Math.max(0, netWorthEntry?.amount ?? (currentMonthIncome - currentMonthExpenses));
    }

    // Upcoming Bills next 14 days
    const upcomingBillsNext14Days: Array<{ title: string; amount: number; dueDate: string }> = (recurringTx || [])
        .filter(r => r.type === 'expense' && r.next_date >= todayStr && r.next_date <= future14Str)
        .map(r => ({
            title: r.name,
            amount: Number(r.amount),
            dueDate: r.next_date,
        }));
    const totalUpcomingBills = upcomingBillsNext14Days.reduce((sum, b) => sum + b.amount, 0);

    // Budget Alerts: Categories currently above 80% utilization or overspent
    const budgetAlerts = budgetWithSpending
        .filter(b => b.monthly_limit > 0 && b.spent / b.monthly_limit >= 0.8)
        .map(b => ({
            category: b.category,
            spent: b.spent,
            monthlyLimit: b.monthly_limit,
            percentUsed: Math.round((b.spent / b.monthly_limit) * 100),
            isOverspent: b.spent > b.monthly_limit,
        }));

    // Collaborative Balances (Bill Splits & Debts)
    let totalOwedToUser = 0;
    let totalUserOwes = (userDebts || []).reduce((sum, d) => sum + Number(d.balance || 0), 0);

    (userBillSplits || []).forEach(split => {
        try {
            const participants = JSON.parse(split.participants_json);
            if (Array.isArray(participants)) {
                participants.forEach(p => {
                    const amt = Number(p.amount ?? p.share ?? 0);
                    if (!p.settled && amt > 0) {
                        if (p.isMe) {
                            totalUserOwes += amt;
                        } else {
                            totalOwedToUser += amt;
                        }
                    }
                });
            }
        } catch { /* ignore JSON parse error */ }
    });

    // Liquidity Calculations
    const daysRemainingInMonth = Math.max(1, daysInMonth - dayOfMonth + 1);
    const totalRemainingBudgetCapacity = budgetWithSpending.reduce((sum, b) => {
        return sum + Math.max(0, b.monthly_limit - b.spent);
    }, 0);

    // Safe to spend: liquid cash reserved for upcoming bills and committed budget
    const committedOutflows = totalUpcomingBills + Math.max(0, totalRemainingBudgetCapacity);
    const safeToSpend = Math.max(0, liquidCash - totalUpcomingBills);
    const dailyAllowance = Math.round((safeToSpend / daysRemainingInMonth) * 100) / 100;

    // Emergency runway in months
    const monthlyBurn = currentMonthExpenses > 0 ? currentMonthExpenses : (totalRemainingBudgetCapacity || 1);
    const emergencyRunwayMonths = monthlyBurn > 0
        ? Math.round((liquidCash / monthlyBurn) * 10) / 10
        : (liquidCash > 0 ? 12 : 0);

    const snapshot: FinancialSnapshot = {
        baseCurrency,
        activeDate: todayStr,
        activeMonth: month,
        activeYear: year,
        liquidity: {
            liquidCash: Math.round(liquidCash * 100) / 100,
            safeToSpend: Math.round(safeToSpend * 100) / 100,
            dailyAllowance,
            emergencyRunwayMonths,
        },
        currentMonthCashflow: {
            income: Math.round(currentMonthIncome * 100) / 100,
            expenses: Math.round(currentMonthExpenses * 100) / 100,
            netSavings: Math.round(netSavings * 100) / 100,
            savingsRatePercent,
        },
        accountsSummary,
        budgetAlerts,
        upcomingBillsNext14Days,
        collaborativeBalances: {
            totalOwedToUser: Math.round(totalOwedToUser * 100) / 100,
            totalUserOwes: Math.round(totalUserOwes * 100) / 100,
        },
    };

    const memory = buildFinancialMemory({
        transactions: currentTransactions,
        budgets: budgetWithSpending,
        goals: savingsGoals,
        recurring: recurringTx,
        notifications,
        customCategories,
        currencySymbol,
    });

    let context = `=== DETERMINISTIC FINANCIAL SNAPSHOT (AUTHORITATIVE LEDGER TRUTH) ===
${JSON.stringify(snapshot, null, 2)}
=== END DETERMINISTIC SNAPSHOT ===\n\n`;

    context += buildContext(
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
        profile: userProfile ? {
            name: userProfile.name,
            currency: userProfile.currency,
            notify_budget: userProfile.notify_budget,
            notify_overspend: userProfile.notify_overspend,
            locale: userProfile.locale || userProfile.preferred_locale || 'en',
        } : undefined,
        currencySymbol,
        snapshot,
    };
}
