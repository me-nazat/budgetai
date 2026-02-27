import { NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { hashPassword, createToken, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { name, email, password } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
        }

        const passwordHash = await hashPassword(password);
        const result = await run(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [name, email, passwordHash]
        );

        const userId = result.lastInsertRowid;
        const token = await createToken(userId, email);
        await setSessionCookie(token);

        return NextResponse.json({ user: { id: userId, name, email } });
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
