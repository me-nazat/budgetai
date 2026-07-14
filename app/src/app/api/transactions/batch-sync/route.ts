export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { run, ensureDbInitialized } from '@/lib/db';
import { maybeCreateBudgetAlert } from '@/lib/alerts';
import { AutomationRulesService } from '@/services/automation-rules.service';
import { AuditService } from '@/services/audit.service';

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
                            let finalCategory = tx.category;
                            let matchedRuleId: number | null = null;

                            if (tx.description && tx.category) {
                                const autoMatch = await AutomationRulesService.applyRules(session.userId, tx.description, tx.category);
                                finalCategory = autoMatch.category;
                                matchedRuleId = autoMatch.matchedRuleId;
                            }

                            if (tx.type) { sets.push('type = ?'); params.push(tx.type); }
                            if (tx.amount > 0) { sets.push('amount = ?'); params.push(tx.amount); }
                            if (finalCategory) { sets.push('category = ?'); params.push(finalCategory); }
                            if (tx.description) { sets.push('description = ?'); params.push(tx.description); }
                            if (tx.date) { sets.push('date = ?'); params.push(tx.date); }

                            if (sets.length > 0) {
                                params.push(tx.txId, session.userId);
                                await run(
                                    `UPDATE transactions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
                                    params
                                );
                            }

                            if (matchedRuleId) {
                                AuditService.logAction({
                                    userId: session.userId,
                                    action: 'UPDATE',
                                    entityType: 'automation_rule',
                                    entityId: matchedRuleId,
                                    newValue: {
                                        event: 'rule_applied',
                                        transactionId: tx.txId,
                                        description: tx.description,
                                        originalCategory: tx.category,
                                        appliedCategory: finalCategory,
                                    },
                                    ip,
                                    userAgent,
                                });
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
                        const autoMatch = await AutomationRulesService.applyRules(session.userId, tx.description, tx.category);
                        const finalCategory = autoMatch.category;

                        const result = await run(
                            'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
                            [session.userId, tx.type, tx.amount, finalCategory, tx.description, tx.date]
                        );

                        if (autoMatch.matchedRuleId) {
                            AuditService.logAction({
                                userId: session.userId,
                                action: 'UPDATE',
                                entityType: 'automation_rule',
                                entityId: autoMatch.matchedRuleId,
                                newValue: {
                                    event: 'rule_applied',
                                    transactionId: result.lastInsertRowid,
                                    description: tx.description,
                                    originalCategory: tx.category,
                                    appliedCategory: finalCategory,
                                },
                                ip,
                                userAgent,
                            });
                        }

                        if (tx.type === 'expense') {
                            await maybeCreateBudgetAlert({
                                userId: session.userId,
                                type: tx.type,
                                amount: tx.amount,
                                category: finalCategory,
                                date: tx.date,
                            });
                        }

                        processedIds.push(tx.client_txn_id);
                    } catch (e) {
                        console.error('Error inserting transaction:', e);
                        failedIds.push(tx.client_txn_id);
                    }
                }
            }
        } catch (dbError) {
            console.error('Database initialization or transaction error:', dbError);
            return NextResponse.json(
                { error: 'Database operation failed' },
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
