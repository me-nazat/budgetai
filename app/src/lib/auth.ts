import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Reject weak or default secrets in production
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret === 'budget-savings-ai-default-secret') {
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'CRITICAL: JWT_SECRET is missing or using the insecure default. ' +
            'Set a strong, unique JWT_SECRET environment variable before deploying.'
        );
    }
    console.warn('[auth] WARNING: Using default JWT secret. Set JWT_SECRET env var for production.');
}

const JWT_SECRET = new TextEncoder().encode(
    rawSecret || 'budget-savings-ai-default-secret-dev-only'
);

const COOKIE_NAME = 'budget-ai-token';
const TOKEN_EXPIRY = '24h';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours (matches token)

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export async function createToken(userId: number, email: string): Promise<string> {
    return new SignJWT({ userId, email })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(TOKEN_EXPIRY)
        .setIssuedAt()
        .setNotBefore('0s')
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: number; email: string } | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const userId = payload.userId;
        const email = payload.email;
        if (typeof userId !== 'number' || typeof email !== 'string') return null;
        return { userId, email };
    } catch {
        return null;
    }
}

export async function getSession(): Promise<{ userId: number; email: string } | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
}

export async function setSessionCookie(token: string) {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
    });
}

export async function clearSessionCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
