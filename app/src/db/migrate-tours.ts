import { run, ensureDbInitialized } from '../lib/db';

async function migrateTourSpendings() {
  await ensureDbInitialized();
  console.log('Migrating existing tour spendings...');
  
  // Create tour spendings from transactions that have a tour_id
  const insertSql = `
    INSERT INTO tour_spendings (tour_id, amount, category, description, date, paid_by_participant_id, split_type, linked_transaction_id, created_at)
    SELECT tour_id, amount, category, description, date, COALESCE(paid_by_participant_id, paid_by), split_type, id, created_at
    FROM transactions 
    WHERE tour_id IS NOT NULL;
  `;
  
  try {
    const res = await run(insertSql);
    console.log(`Migrated ${res.rowsAffected} tour spendings.`);
  } catch (error) {
    console.error('Error migrating tour spendings:', error);
  }
}

migrateTourSpendings();
