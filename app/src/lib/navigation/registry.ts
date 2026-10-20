/**
 * @fileoverview Centralized 7-Pillar Typed Route Registry
 *
 * Single source of truth for the institutional-grade 7-Pillar Navigation Architecture
 * across Desktop Sidebar, Mobile Drawer Menu, Mobile Bottom Tab Bar, and Command Palette.
 */

export interface NavSubItem {
  id: string;
  href: string;
  label: string;
  icon: string;
  guestAllowed?: boolean;
}

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: string;
  category: 'pillar' | 'system';
  description?: string;
  filledIcon?: boolean;
  mobileTab?: boolean;
  guestAllowed?: boolean;
  subItems?: NavSubItem[];
}

/**
 * The 7 Canonical Primary Pillars
 */
export const SEVEN_PILLARS: NavItem[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    label: 'Command Center',
    icon: 'dashboard',
    category: 'pillar',
    filledIcon: true,
    mobileTab: true,
    description: 'Unified cashflow runway, net worth ticker, and active financial pulse',
  },
  {
    id: 'accounts',
    href: '/accounts',
    label: 'Accounts & Cards',
    icon: 'account_balance_wallet',
    category: 'pillar',
    description: 'Multi-currency holdings, bank links, and credit utilization',
  },
  {
    id: 'transactions',
    href: '/transactions',
    label: 'Transactions',
    icon: 'receipt_long',
    category: 'pillar',
    mobileTab: true,
    description: 'Unified high-speed ledger',
  },
  {
    id: 'budget',
    href: '/budget',
    label: 'Budget & Subscriptions',
    icon: 'donut_large',
    category: 'pillar',
    description: 'Rollover envelope budgeting, pacing gauges, and recurring billing',
    subItems: [
      { id: 'recurring', href: '/recurring-subscriptions', label: 'Recurring & Subs', icon: 'repeat' },
    ],
  },
  {
    id: 'household',
    href: '/household',
    label: 'Collaborative Wealth',
    icon: 'groups',
    category: 'pillar',
    mobileTab: true,
    description: 'Unified group expenses, split bills, and shared trip ledgers',
    subItems: [
      { id: 'tours', href: '/tours', label: 'Trip Ledgers & Tours', icon: 'flight_takeoff', guestAllowed: true },
    ],
  },
  {
    id: 'wealth-goals',
    href: '/wealth-goals',
    label: 'Goals & Net Worth',
    icon: 'trending_up',
    category: 'pillar',
    description: 'Short-term savings goals, FIRE calculator, and debt payoff planner',
    subItems: [
      { id: 'debts', href: '/debts', label: 'Debt Planner', icon: 'credit_score' },
      { id: 'networth', href: '/networth', label: 'Net Worth', icon: 'account_balance' },
      { id: 'investments', href: '/investments', label: 'Investments', icon: 'show_chart' },
    ],
  },
  {
    id: 'insights',
    href: '/insights',
    label: 'Intelligence & Reports',
    icon: 'auto_awesome',
    category: 'pillar',
    description: 'Cashflow intelligence, 90-day forecast, and financial statements & exports',
    subItems: [
      { id: 'tax-center', href: '/tax-center', label: 'Tax & Vault', icon: 'receipt' },
      { id: 'chat', href: '/chat', label: 'AI Advisor Chat', icon: 'smart_toy' },
      { id: 'bank-import', href: '/bank-import', label: 'Bank Import', icon: 'upload_file' },
    ],
  },
];

export const SYSTEM_NAV_ITEMS: NavItem[] = [
  {
    id: 'automation-rules',
    href: '/automation-rules',
    label: 'Automation Rules',
    icon: 'rule',
    category: 'system',
    description: 'Custom trigger-based automated financial rules',
  },
  {
    id: 'notifications',
    href: '/notifications',
    label: 'Alerts',
    icon: 'notifications',
    category: 'system',
    description: 'Real-time proactive notifications and anomaly alerts',
  },
  {
    id: 'settings',
    href: '/settings',
    label: 'Settings',
    icon: 'settings',
    category: 'system',
    description: 'Preferences, security passkeys, and account controls',
  },
];

export const NAVIGATION_REGISTRY: NavItem[] = [...SEVEN_PILLARS, ...SYSTEM_NAV_ITEMS];

export const NAV_GROUPS: { label: string | null; category: NavItem['category'] }[] = [
  { label: 'Primary Pillars', category: 'pillar' },
  { label: 'System', category: 'system' },
];

export const NAV_TRANSLATION_MAP: Record<string, string> = {
  'dashboard': 'commandCenter',
  'accounts': 'accountsCards',
  'transactions': 'transactions',
  'budget': 'budgetSubscriptions',
  'household': 'collaborativeWealth',
  'wealth-goals': 'goalsNetWorth',
  'insights': 'intelligenceVault',
  'tours': 'tourManager',
  'debts': 'debts',
  'investments': 'investments',
  'tax-center': 'taxVault',
  'documents': 'documents',
  'chat': 'chat',
  'bank-import': 'bankImport',
  'recurring': 'recurring',
  'recurring-subscriptions': 'recurring',
  'automation-rules': 'automationRules',
  'notifications': 'alerts',
  'settings': 'settings',
};
