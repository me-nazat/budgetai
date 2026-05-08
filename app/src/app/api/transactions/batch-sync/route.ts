import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { run, ensureDbInitialized, queryOne } from '@/lib/db';

interface TransactionPayload {
    id?: string; // Client-side ID for tracking
    payload?: {
        actionType?: 'add' | 'edit' | 'delete';
        id?: number | string; // Server-side ID for existing transactions
        type?: string;
        amount?: number | string;
        category?: string;
        description?: string;
        date?: string;
    };
}

interface ValidTransactionPayload extends TransactionPayload {
    id: string;
    payload: NonNullable<TransactionPayload['payload']>;
}

interface ProcessedTransaction {
    actionType: 'add' | 'edit' | 'delete';
    txId: number | string | null;
    type: string;
    amount: number;
    category: string;
    description: string;
    date: string;
    client_txn_id: string;
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

        const processedIds: string[] = [];
        const failedIds: string[] = [];
        const today = new Date().toISOString().split('T')[0];

        // Validate each payload and filter out invalid ones
        const validTransactions = transactions.filter((tx): tx is ValidTransactionPayload => {
            if (!tx.id) { // Client-side ID is mandatory for tracking
                failedIds.push('unknown_client_id'); // Or handle as appropriate
                return false;
            }

            if (!tx.payload) {
                failedIds.push(tx.id);
                return false;
            }

            const actionType = tx.payload.actionType || 'add';
            if (actionType === 'delete') {
                if (!tx.payload.id) {
                    failedIds.push(tx.id);
                    return false;
                }
                return true;
            }

            const amount = parseFloat(String(tx.payload.amount ?? ''));
            if (!tx.payload.type || !tx.payload.category || !Number.isFinite(amount) || amount <= 0) {
                failedIds.push(tx.id);
                return false;
            }
            return true;
        });

        // Process all valid transactions in an extended database transaction
        // First we extract them
        const toProcess: ProcessedTransaction[] = validTransactions.map(tx => ({
            actionType: tx.payload.actionType || 'add',
            txId: tx.payload.id || null, // Might be null for 'add'
            type: tx.payload.type || '',
            amount: parseFloat(String(tx.payload.amount ?? '')) || 0,
            category: tx.payload.category || '',
            description: tx.payload.description || '',
            date: tx.payload.date || today,
            client_txn_id: tx.id // the offline uuid
        }));

        try {
            await ensureDbInitialized();

            // Execute processing sequentially for now to catch specific errors
            for (const tx of toProcess) {
                if (tx.actionType === 'delete') {
                    if (tx.txId) {
                        try {
                            await run(
                                'DELETE FROM transactions WHERE id = ? AND user_id = ?',
                                [tx.txId, session.userId]
                            );
                            processedIds.push(tx.client_txn_id);
                        } catch (e) {
                            console.error(`Error deleting transaction ${tx.txId}:`, e);
                            failedIds.push(tx.client_txn_id);
                        }
                    } else {
                        // Delete requested but no ID provided? Fail
                        failedIds.push(tx.client_txn_id);
                    }
                } else if (tx.actionType === 'edit') {
                    if (tx.txId) {
                        try {
                            const sets = [];
                            const params: unknown[] = [];

                            if (tx.type) { sets.push('type = ?'); params.push(tx.type); }
                            if (tx.amount > 0) { sets.push('amount = ?'); params.push(tx.amount); }
                            if (tx.category) { sets.push('category = ?'); params.push(tx.category); }
                            if (tx.description) { sets.push('description = ?'); params.push(tx.description); }
                            if (tx.date) { sets.push('date = ?'); params.push(tx.date); }

                            if (sets.length > 0) {
                                params.push(tx.txId, session.userId);
                                await run(
                                    `UPDATE transactions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
                                    params
                                );
                            }
                            processedIds.push(tx.client_txn_id);
                        } catch (e) {
                            console.error(`Error editing transaction ${tx.txId}:`, e);
                            failedIds.push(tx.client_txn_id);
                        }
                    } else {
                        failedIds.push(tx.client_txn_id);
                    }
                } else {
                    // Default is 'add'
                    try {
                        await run(
                            'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
                            [session.userId, tx.type, tx.amount, tx.category, tx.description, tx.date]
                        );

                        // Budget updates for additions
                        if (tx.type === 'expense') {
                            const txMonth = new Date(tx.date).getMonth() + 1;
                            const txYear = new Date(tx.date).getFullYear();
                            const budget = await queryOne<{ monthly_limit: number; id: number }>(
                                'SELECT id, monthly_limit FROM budgets WHERE user_id = ? AND LOWER(category) = LOWER(?) AND month = ? AND year = ?',
                                [session.userId, tx.category, txMonth, txYear]
                            );

                            if (budget) {
                                const spent = await queryOne<{ total: number }>(
                                    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND LOWER(category) = LOWER(?) AND type = ? AND strftime("%Y-%m", date) = ?',
                                    [session.userId, tx.category, 'expense', `${txYear}-${String(txMonth).padStart(2, '0')}`]
                                );

                                const currentSpent = spent?.total || 0;
                                // Simplified notification logic for batch sync to avoid blocking
                                if (currentSpent > budget.monthly_limit) {
                                    await run(
                                        'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
                                        [session.userId, 'danger', `Over Budget: ${tx.category}`, `You've exceeded your $${budget.monthly_limit} budget for ${tx.category}.`]
                                    );
                                }
                            }
                        }

                        processedIds.push(tx.client_txn_id);
                    } catch (e) {
                        console.error('Error inserting transaction:', e);
                        failedIds.push(tx.client_txn_id);
                    }
                }
            }
        } catch (dbError) {
            const message = dbError instanceof Error ? dbError.message : String(dbError);
            console.error('Database initialization or transaction error:', dbError);
            return NextResponse.json(
                { error: 'Database operation failed', details: message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            synced: processedIds.length,
            processedIds,
            failedIds,
        });
    } catch (error) {
        console.error('Batch sync error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
