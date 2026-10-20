export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { TransactionService } from '@/services/transaction.service';

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
        notes?: string;
        splits?: Array<{ id: string; category: string; amount: number; note?: string; isTaxDeductible?: boolean }>;
        taxDeductible?: boolean;
        accountId?: number;
        toAccountId?: number;
        clientMutationId?: string;
    };
}

interface ValidTransactionPayload extends TransactionPayload {
    id: string;
    payload: NonNullable<TransactionPayload['payload']>;
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const userAgent = request.headers.get('user-agent') || undefined;

        const { transactions } = (await request.json()) as {
            transactions: TransactionPayload[];
        };

        if (!Array.isArray(transactions) || transactions.length === 0) {
            return NextResponse.json(
                { error: 'transactions array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Limit batch size to prevent abuse
        if (transactions.length > 100) {
            return NextResponse.json(
                { error: 'Maximum 100 transactions per batch' },
                { status: 400 }
            );
        }

        const processedIds: string[] = [];
        const failedIds: string[] = [];
        const today = new Date().toISOString().split('T')[0];

        // Validate each payload and filter out invalid ones
        const validTransactions = transactions.filter((tx): tx is ValidTransactionPayload => {
            if (!tx.id) {
                failedIds.push('unknown_client_id');
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

        for (const tx of validTransactions) {
            const clientTxId = tx.id;
            const actionType = tx.payload.actionType || 'add';

            try {
                if (actionType === 'delete') {
                    if (tx.payload.id) {
                        await TransactionService.delete(session.userId, Number(tx.payload.id), { ip, userAgent });
                        processedIds.push(clientTxId);
                    } else {
                        failedIds.push(clientTxId);
                    }
                } else if (actionType === 'edit') {
                    if (tx.payload.id) {
                        const parsedAmount = tx.payload.amount ? parseFloat(String(tx.payload.amount)) : undefined;
                        await TransactionService.patch(
                            session.userId,
                            {
                                id: Number(tx.payload.id),
                                type: tx.payload.type,
                                amount: parsedAmount,
                                category: tx.payload.category,
                                description: tx.payload.description,
                                date: tx.payload.date,
                                notes: tx.payload.notes,
                                splits: tx.payload.splits,
                                taxDeductible: tx.payload.taxDeductible,
                                accountId: tx.payload.accountId,
                                toAccountId: tx.payload.toAccountId,
                            },
                            { ip, userAgent }
                        );
                        processedIds.push(clientTxId);
                    } else {
                        failedIds.push(clientTxId);
                    }
                } else {
                    // Default: 'add' with idempotency check on clientMutationId
                    const parsedAmount = parseFloat(String(tx.payload.amount));
                    await TransactionService.create(
                        session.userId,
                        {
                            clientMutationId: tx.payload.clientMutationId || clientTxId,
                            type: tx.payload.type,
                            amount: parsedAmount,
                            category: tx.payload.category,
                            description: tx.payload.description || tx.payload.category,
                            date: tx.payload.date || today,
                            notes: tx.payload.notes,
                            splits: tx.payload.splits,
                            taxDeductible: tx.payload.taxDeductible,
                            accountId: tx.payload.accountId,
                            toAccountId: tx.payload.toAccountId,
                        },
                        { ip, userAgent }
                    );
                    processedIds.push(clientTxId);
                }
            } catch (err) {
                console.error(`[batch-sync] Error processing transaction ${clientTxId}:`, err);
                failedIds.push(clientTxId);
            }
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
