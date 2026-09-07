/**
 * @fileoverview Drizzle ORM schema for Module 21: Anonymous Peer Benchmarking,
 * Granular Consents, and Anonymous Share Cards.
 *
 * Implements Module 11 extensions (Features 11.1 & 11.2).
 *
 * @module db/schema/benchmarks-modules21
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { categoryPercentileSnapshots } from './index';

export const module21UserBenchmarkConsents = sqliteTable(
  'module_21_user_benchmark_consents',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    metricKey: text('metric_key').notNull(), // 'SAVINGS_RATE', 'NET_WORTH', 'EMERGENCY_FUND_MONTHS', 'CATEGORY_SPEND'
    grantedAt: integer('granted_at').default(sql`(unixepoch())`),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    index('idx_m21_consents_user').on(table.userId, table.metricKey),
  ]
);

export const module21AnonymousShareCards = sqliteTable(
  'module_21_anonymous_share_cards',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    snapshotId: integer('snapshot_id')
      .references(() => categoryPercentileSnapshots.id, { onDelete: 'set null' }),
    claimText: text('claim_text').notNull(),
    imageUrl: text('image_url').notNull(),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m21_share_cards_user').on(table.userId),
  ]
);

export type Module21UserBenchmarkConsent = typeof module21UserBenchmarkConsents.$inferSelect;
export type NewModule21UserBenchmarkConsent = typeof module21UserBenchmarkConsents.$inferInsert;

export type Module21AnonymousShareCard = typeof module21AnonymousShareCards.$inferSelect;
export type NewModule21AnonymousShareCard = typeof module21AnonymousShareCards.$inferInsert;
