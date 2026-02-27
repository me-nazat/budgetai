import { createClient } from '@libsql/client';
const client = createClient({ url: 'file:budget-ai.db' });
async function test() {
  const rs = await client.execute("SELECT category, SUM(amount) as total FROM transactions GROUP BY category");
  console.log(rs.rows);
}
test();
