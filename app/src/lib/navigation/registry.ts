/**
 * @fileoverview Centralized Typed Route Registry
 *
 * Single source of truth for all application routes across Desktop Sidebar,
 * Mobile Drawer Menu, and Mobile Bottom Tab Bar.
 *
 * Enforces AUD-003 navigation parity and typing.
 */

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: string;
  category: 'core' | 'analytics' | 'tools' | 'smart' | 'system';
  filledIcon?: boolean;
  mobileTab?: boolean;
  guestAllowed?: boolean;
}

export const NAVIGATION_REGISTRY: NavItem[] = [
  // Core Group
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: 'dashboard', category: 'core', filledIcon: true, mobileTab: true },
  { id: 'chat', href: '/chat', label: 'AI Chat', icon: 'smart_toy', category: 'core', mobileTab: true },
  { id: 'transactions', href: '/transactions', label: 'Transactions', icon: 'receipt_long', category: 'core' },
  { id: 'budget', href: '/budget', label: 'Budgets', icon: 'account_balance_wallet', category: 'core' },

  // Analytics Group
  { id: 'my-month', href: '/my-month', label: 'My Month', icon: 'calendar_month', category: 'analytics' },
  { id: 'reports', href: '/reports', label: 'Reports', icon: 'bar_chart', category: 'analytics' },
  { id: 'overview', href: '/overview', label: 'Overview', icon: 'analytics', category: 'analytics', mobileTab: true },
  { id: 'benchmarks', href: '/benchmarks', label: 'Benchmarks', icon: 'leaderboard', category: 'analytics' },
  { id: 'insights', href: '/insights', label: 'Insights', icon: 'lightbulb', category: 'analytics' },

  // Financial Tools Group
  { id: 'accounts', href: '/accounts', label: 'Accounts', icon: 'account_balance', category: 'tools' },
  { id: 'household', href: '/household', label: 'Household', icon: 'family_restroom', category: 'tools' },
  { id: 'bill-split', href: '/bill-split', label: 'Bill Split', icon: 'call_split', category: 'tools' },
  { id: 'tours', href: '/tours', label: 'Tour Manager', icon: 'flight_takeoff', category: 'tools', guestAllowed: true },
  { id: 'wealth-goals', href: '/wealth-goals', label: 'Wealth & Goals', icon: 'flag_circle', category: 'tools' },
  { id: 'debts', href: '/debts', label: 'Debt Planner', icon: 'credit_card', category: 'tools' },
  { id: 'forecast', href: '/forecast', label: 'Cash Flow Forecast', icon: 'timeline', category: 'tools' },
  { id: 'investments', href: '/investments', label: 'Investments', icon: 'trending_up', category: 'tools' },
  { id: 'achievements', href: '/achievements', label: 'Achievements', icon: 'emoji_events', category: 'tools' },
  { id: 'fire', href: '/fire', label: 'FIRE Simulator', icon: 'rocket_launch', category: 'tools' },

  // Smart Tools Group
  { id: 'tax-center', href: '/tax-center', label: 'Tax Center', icon: 'receipt', category: 'smart' },
  { id: 'documents', href: '/documents', label: 'Documents', icon: 'folder_open', category: 'smart' },
  { id: 'bank-import', href: '/bank-import', label: 'Bank Import', icon: 'upload_file', category: 'smart' },

  // System Group
  { id: 'recurring-subscriptions', href: '/recurring-subscriptions', label: 'Recurring & Subs', icon: 'repeat', category: 'system' },
  { id: 'automation-rules', href: '/automation-rules', label: 'Automation Rules', icon: 'auto_awesome', category: 'system' },
  { id: 'notifications', href: '/notifications', label: 'Alerts', icon: 'notifications', category: 'system' },
];

export const NAV_GROUPS: { label: string | null; category: NavItem['category'] }[] = [
  { label: null, category: 'core' },
  { label: 'Analytics', category: 'analytics' },
  { label: 'Financial Tools', category: 'tools' },
  { label: 'Smart Tools', category: 'smart' },
  { label: 'System', category: 'system' },
];
