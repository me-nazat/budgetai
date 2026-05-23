import 'dotenv/config';
import { ensureDbInitialized } from './src/lib/db.js';

async function test() {
  try {
    await ensureDbInitialized();
    console.log('DB init SUCCESS');
  } catch (err) {
    console.error('DB init FAILED:', err);
  }
}
test();
