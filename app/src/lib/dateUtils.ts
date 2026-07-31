/**
 * @fileoverview Date utility functions for Wealth AI.
 * 
 * Provides safe month options generation without JS Date overflow bugs on 31st.
 */

export interface MonthOption {
  value: string; // 'YYYY-MM'
  label: string; // 'July 2026'
}

/**
 * Generates an array of unique month options starting from the current month going back N months.
 * Anchors each date to day 1 to prevent JavaScript Date overflow bugs when run on 31st of a month.
 *
 * @param count - Number of months to generate (default 12)
 * @returns Array of unique MonthOption objects
 */
export function generateMonthOptions(count = 12): MonthOption[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  return Array.from({ length: count }).map((_, index) => {
    // Construct Date anchored on the 1st of the month
    const d = new Date(currentYear, currentMonth - index, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return { value, label };
  });
}
