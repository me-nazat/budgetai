import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: node scripts/reset-user-password.mjs <email> <newPassword>');
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('Error: TURSO_DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function main() {
  const cleanEmail = email.toLowerCase().trim();
  const res = await client.execute({
    sql: 'SELECT id, email, name FROM users WHERE LOWER(TRIM(email)) = ?',
    args: [cleanEmail],
  });

  if (res.rows.length === 0) {
    console.error(`User with email "${email}" not found in database.`);
    process.exit(1);
  }

  const user = res.rows[0];
  const newHash = await bcrypt.hash(newPassword, 12);

  await client.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [newHash, user.id],
  });

  console.log(`Success! Updated password for user ${user.name} (${user.email}, ID: ${user.id}).`);
}

main().catch((err) => {
  console.error('Error resetting password:', err);
  process.exit(1);
});
