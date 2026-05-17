import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyPassword, createToken, setSessionCookie } from '@/lib/auth';
import { checkRateLimit, getClientIP } from '@/lib/validation';

export async function POST(request: Request) {
    try {
        // Rate limit: 5 login attempts per 15 min per IP
        const ip = getClientIP(request);
        const rl = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many login attempts. Please try again later.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
            );
        }

        const body = await request.json();
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = await queryOne<{ id: number; name: string; email: string; password_hash: string; currency: string }>(
            'SELECT id, name, email, password_hash, currency FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const token = await createToken(user.id, user.email);
        await setSessionCookie(token);

        return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, currency: user.currency } });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
