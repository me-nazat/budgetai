import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const userDemographics = sqliteTable('user_demographics', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  ageBracket: text('age_bracket').notNull(), // '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
  regionCode: text('region_code').notNull().default('GLOBAL'),
  incomeBracket: text('income_bracket').notNull(), // '0-30k', '30k-60k', '60k-100k', '100k-150k', '150k+'
  employmentSector: text('employment_sector'),
  isOptedIn: integer('is_opted_in').notNull().default(1),
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
