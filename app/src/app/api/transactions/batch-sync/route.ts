import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { run } from '@/lib/db';

interface TransactionPayload {
    type: string;
    amount: number;
    category: string;
    description: string;
    date: string;
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { transactions } = (await request.json()) as {
            transactions: TransactionPayload[];
        };

        if (!Array.isArray(transactions) || transactions.length === 0) {
            return NextResponse.json(
                { error: 'transactions array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Validate each payload
        for (const tx of transactions) {
            if (!tx.type || !tx.amount) {
                return NextResponse.json(
                    { error: 'Each transaction must have type and amount' },
                    { status: 400 }
                );
            }
        }

        // Insert each transaction sequentially using the shared db.ts helpers.
        // This reuses the existing ensureInitialized() guard and Turso client.
        // Each insert gets a fresh server-generated ID (AUTOINCREMENT).
        for (const tx of transactions) {
            await run(
                'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    session.userId,
                    tx.type,
                    tx.amount,
                    tx.category || 'Other',
                    tx.description || '',
                    tx.date || new Date().toISOString().split('T')[0],
                ]
            );
        }

        return NextResponse.json({ synced: transactions.length });
    } catch (error) {
        console.error('Batch sync error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

