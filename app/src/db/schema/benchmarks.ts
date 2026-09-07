import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

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

export type UserDemographic = typeof userDemographics.$inferSelect;
export type NewUserDemographic = typeof userDemographics.$inferInsert;

export type BenchmarkAggregate = typeof benchmarkAggregates.$inferSelect;
export type NewBenchmarkAggregate = typeof benchmarkAggregates.$inferInsert;
