export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    condition: (stats: UserStats) => boolean;
}

export interface UserStats {
    totalTransactions: number;
    totalSavingsGoalsMet: number;
    consecutiveLoginDays: number; // Difficult to track perfectly without daily login logs, we'll approximate or use transaction count
    monthsUnderBudget: number;
    netWorth: number;
}

export const BADGES: Badge[] = [
    {
        id: 'first_transaction',
        name: 'First Step',
        description: 'Record your first transaction.',
        icon: 'account_balance_wallet',
        color: 'bg-blue-500',
        condition: (stats) => stats.totalTransactions >= 1
    },
    {
        id: 'century_club',
        name: 'Century Club',
        description: 'Record 100 transactions.',
        icon: 'military_tech',
        color: 'bg-indigo-500',
        condition: (stats) => stats.totalTransactions >= 100
    },
    {
        id: 'saver_rookie',
        name: 'Savings Rookie',
        description: 'Complete your first savings goal.',
        icon: 'savings',
        color: 'bg-emerald-500',
        condition: (stats) => stats.totalSavingsGoalsMet >= 1
    },
    {
        id: 'budget_master',
        name: 'Budget Master',
        description: 'Stay under budget for 3 months.',
        icon: 'workspace_premium',
        color: 'bg-amber-500',
        condition: (stats) => stats.monthsUnderBudget >= 3
    },
    {
        id: 'net_worth_milestone_1',
        name: '10K Milestone',
        description: 'Reach a net worth of $10,000.',
        icon: 'diamond',
        color: 'bg-cyan-500',
        condition: (stats) => stats.netWorth >= 10000
    },
    {
        id: 'net_worth_milestone_2',
        name: '100K Milestone',
        description: 'Reach a net worth of $100,000.',
        icon: 'crown',
        color: 'bg-fuchsia-500',
        condition: (stats) => stats.netWorth >= 100000
    }
];

export function getUnlockedBadges(stats: UserStats): string[] {
    return BADGES.filter(badge => badge.condition(stats)).map(b => b.id);
}
