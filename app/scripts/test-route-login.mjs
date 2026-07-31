import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { UserRepository } from '../src/repositories/user.repository.js';
import { AuthService } from '../src/services/auth.service.js';

async function main() {
  console.log('--- DB USER LOOKUP TEST ---');
  const user = await UserRepository.findByEmail('nazatal619@gmail.com');
  console.log('findByEmail result:', user ? { id: user.id, email: user.email, name: user.name } : 'NOT FOUND');

  if (user) {
    console.log('--- AUTH SERVICE LOGIN TEST ---');
    try {
      const res = await AuthService.login(
        { email: 'nazatal619@gmail.com', password: 'nazat123' },
        { ip: '127.0.0.1', userAgent: 'test-agent' }
      );
      console.log('AuthService.login SUCCESS! User:', res.user);
    } catch (err) {
      console.error('AuthService.login THREW ERROR:', err);
    }
  }
}

main().catch(console.error);
