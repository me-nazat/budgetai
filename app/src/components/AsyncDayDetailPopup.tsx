'use client';

/**
 * @fileoverview Re-export DayDetailPopup for backward compatibility.
 * Consolidates async data-fetching and interactive popups into a single canonical component.
 *
 * @module components/AsyncDayDetailPopup
 */

import DayDetailPopup, { type DayDetailPopupProps } from './DayDetailPopup';

export { DayDetailPopup };
export type { DayDetailPopupProps };
export default DayDetailPopup;
