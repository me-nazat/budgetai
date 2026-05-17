import { NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { hashPassword, createToken, setSessionCookie } from '@/lib/auth';
import { isValidEmail, isValidPassword, sanitizeName, checkRateLimit, getClientIP } from '@/lib/validation';

export async function POST(request: Request) {
    try {
        // Rate limit: 5 registrations per 15 min per IP
        const ip = getClientIP(request);
        const rl = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many registration attempts. Please try again later.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
            );
        }

        const body = await request.json();
        const name = sanitizeName(body.name);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        if (!isValidEmail(email)) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
        }

        if (!isValidPassword(password)) {
            return NextResponse.json({ error: 'Password must be 6-128 characters' }, { status: 400 });
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
