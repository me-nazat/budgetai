/**
 * @fileoverview Benchmarking schema — user demographics, aggregate percentiles,
 * per-category snapshots, granular consents, and anonymous share cards.
 *
 * Consolidates:
 * - Gen 2: benchmarks.ts (userDemographics, benchmarkAggregates)
 * - Gen 1: index.ts Module 11 (categoryPercentileSnapshots)
 * - Gen 3: benchmarks-modules21.ts (module21UserBenchmarkConsents, module21AnonymousShareCards)
 *
 * @module db/schema/benchmarks
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/* ───────────────────────────────────────────────────────────────
   USER DEMOGRAPHICS (Gen 2 — canonical)
   ─────────────────────────────────────────────────────────────── */

export const userDemographics = sqliteTable('user_demographics', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  ageBracket: text('age_bracket').notNull(),
  householdSizeBracket: text('household_size_bracket'),
  regionBracket: text('region_bracket'),
  regionCode: text('region_code').notNull().default('GLOBAL'),
  incomeBracket: text('income_bracket').notNull().default('60k-100k'),
  employmentSector: text('employment_sector'),
  isOptedIn: integer('is_opted_in').notNull().default(1),
  optedInAt: text('opted_in_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

export type UserDemographic = typeof userDemographics.$inferSelect;
export type NewUserDemographic = typeof userDemographics.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   BENCHMARK AGGREGATES (Gen 2)
   ─────────────────────────────────────────────────────────────── */

export const benchmarkAggregates = sqliteTable(
  'benchmark_aggregates',
  {
    id: text('id').primaryKey(),
    cohortKey: text('cohort_key').notNull(), // e.g. '25-34_US_100k-150k'
    metricType: text('metric_type').notNull(), // 'SAVINGS_RATE', 'NET_WORTH', 'EMERGENCY_FUND_MONTHS'
    p10: real('p10').notNull(),
    p25: real('p25').notNull(),
    p50: real('p50').notNull(),
    p75: real('p75').notNull(),
    p90: real('p90').notNull(),
    sampleSize: integer('sample_size').notNull(),
    lastCalculatedAt: integer('last_calculated_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_benchmark_cohort_metric').on(table.cohortKey, table.metricType),
  ]
);

export type BenchmarkAggregate = typeof benchmarkAggregates.$inferSelect;
export type NewBenchmarkAggregate = typeof benchmarkAggregates.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   CATEGORY PERCENTILE SNAPSHOTS (ex index.ts Gen 1 — Module 11)
   ─────────────────────────────────────────────────────────────── */

/** Monthly category percentile snapshot for peer benchmarking */
export const categoryPercentileSnapshots = sqliteTable(
  'category_percentile_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // e.g. "2026-07"
    category: text('category').notNull(),
    userSpent: real('user_spent').notNull(),
    p50Spent: real('p50_spent').notNull(),
    p90Spent: real('p90_spent').notNull(),
    percentileRank: real('percentile_rank').notNull(), // 0 to 100
    cohortSize: integer('cohort_size').default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_cat_pct_snapshots_user_month').on(table.userId, table.yearMonth),
  ]
);

export type CategoryPercentileSnapshot = typeof categoryPercentileSnapshots.$inferSelect;
export type NewCategoryPercentileSnapshot = typeof categoryPercentileSnapshots.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   USER BENCHMARK CONSENTS (ex benchmarks-modules21.ts Gen 3)
   SQL table name preserved: module_21_user_benchmark_consents
   ─────────────────────────────────────────────────────────────── */

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

export type Module21UserBenchmarkConsent = typeof module21UserBenchmarkConsents.$inferSelect;
export type NewModule21UserBenchmarkConsent = typeof module21UserBenchmarkConsents.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   ANONYMOUS SHARE CARDS (ex benchmarks-modules21.ts Gen 3)
   SQL table name preserved: module_21_anonymous_share_cards
   ─────────────────────────────────────────────────────────────── */

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

export type Module21AnonymousShareCard = typeof module21AnonymousShareCards.$inferSelect;
export type NewModule21AnonymousShareCard = typeof module21AnonymousShareCards.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   BENCHMARK DEMOGRAPHICS (Gen 1)
   ─────────────────────────────────────────────────────────────── */

export const benchmarkDemographics = sqliteTable(
  'benchmark_demographics',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ageTier: text('age_tier').notNull(),
    regionCode: text('region_code').notNull(),
    incomeBracket: text('income_bracket').notNull(),
    category: text('category').notNull(),
    p50Amount: real('p50_amount').notNull(),
    p90Amount: real('p90_amount').notNull(),
  },
  (table) => [
    index('idx_benchmark_demo_cohort').on(table.ageTier, table.regionCode, table.incomeBracket),
  ]
);

export type BenchmarkDemographic = typeof benchmarkDemographics.$inferSelect;
export type NewBenchmarkDemographic = typeof benchmarkDemographics.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   PERCENTILE SNAPSHOTS (Gen 1)
   ─────────────────────────────────────────────────────────────── */

export const percentileSnapshots = sqliteTable(
  'percentile_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    savingsRatePercentile: real('savings_rate_percentile').notNull(),
    healthScore: real('health_score').notNull(),
    cohortId: text('cohort_id'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_percentile_snapshots_user').on(table.userId, table.month),
  ]
);

export type PercentileSnapshot = typeof percentileSnapshots.$inferSelect;
export type NewPercentileSnapshot = typeof percentileSnapshots.$inferInsert;

