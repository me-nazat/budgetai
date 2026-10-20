export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { getSession } from '@/lib/security/session-manager';
import { run } from '@/lib/db';
import { AttachmentInput, processMessage } from '@/lib/ai';
import { getFinancialContextBundle } from '@/lib/financialContext';
import { ActionResult, StoredTransaction, processDataActions, storeFinancialData } from '@/lib/chatActions';
import { uploadChatAttachmentsToGemini } from '@/lib/google-drive';

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 12000;

function isTextLike(file: File) {
    const name = file.name.toLowerCase();
    return file.type.startsWith('text/')
        || file.type.includes('json')
        || file.type.includes('csv')
        || name.endsWith('.txt')
        || name.endsWith('.md')
        || name.endsWith('.csv')
        || name.endsWith('.json');
}

async function readAttachment(file: File): Promise<AttachmentInput> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base = {
        name: file.name || 'attachment',
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
    };

    if (isTextLike(file)) {
        return {
            ...base,
            extractedText: buffer.toString('utf8').slice(0, MAX_TEXT_CHARS),
        };
    }

    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        return {
            ...base,
            data: buffer.toString('base64'),
        };
    }

    return {
        ...base,
        extractedText: `The file ${file.name} (${file.type || 'unknown type'}) was attached, but this format is not directly readable yet.`,
    };
}

async function parseChatRequest(request: Request) {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
        const body = await request.json();
        return {
            message: String(body.message || ''),
            mode: body.mode === 'silent' ? 'silent' : 'chat',
            sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
            attachments: [] as AttachmentInput[],
            rawFiles: [] as File[],
            hasAttachments: false,
        };
    }

    const form = await request.formData();
    const files = form.getAll('attachments').filter((value): value is File => value instanceof File).slice(0, MAX_ATTACHMENTS);
    const attachments: AttachmentInput[] = [];

    for (const file of files) {
        if (file.size <= MAX_ATTACHMENT_BYTES) {
            attachments.push(await readAttachment(file));
        } else {
            attachments.push({
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                extractedText: `Skipped: file is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB.`,
            });
        }
    }

    return {
        message: String(form.get('message') || ''),
        mode: form.get('mode') === 'silent' ? 'silent' : 'chat',
        sessionId: typeof form.get('sessionId') === 'string' ? String(form.get('sessionId')) : undefined,
        attachments,
        rawFiles: files,
        hasAttachments: attachments.length > 0,
    };
}

export const POST = apiHandler(
    withAuth(async (request: NextRequest, { userId }) => {
        const { message, mode, sessionId, attachments, rawFiles, hasAttachments } = await parseChatRequest(request);
        if (!message && attachments.length === 0) {
            return NextResponse.json({ error: 'Message or attachment is required' }, { status: 400 });
        }

        const chatSessionId = sessionId || `session_${Date.now()}`;
        const today = new Date().toISOString().split('T')[0];
        const attachmentNames = attachments.map(a => a.name).join(', ');
        const userContent = attachmentNames ? `${message || 'Analyze these attachments.'}\n\nAttachments: ${attachmentNames}` : message;

        await run(
            'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
            [userId, 'user', userContent, mode, chatSessionId]
        );

        const contextBundle = await getFinancialContextBundle(userId, chatSessionId);
        
        let driveUploadInfo = '';
        // Background upload to Gemini -> User -> Session in Google Drive
        if (hasAttachments && rawFiles.length > 0) {
            try {
                const uploadResult = await uploadChatAttachmentsToGemini({
                    userId: userId,
                    userName: contextBundle.profile?.name,
                    sessionId: chatSessionId,
                    files: rawFiles,
                });
                driveUploadInfo = `\n\n[SYSTEM NOTE: The attached files have been securely staged for analysis. Files uploaded: ${uploadResult.files.map(f => f.name).join(', ')}]`;
            } catch (e) {
                console.error('Failed to upload to Gemini Drive folder:', e);
                driveUploadInfo = `\n\n[SYSTEM NOTE: Failed to upload attached files to Google Drive.]`;
            }
        }

        const safeUserMessage = message || 'Analyze the attached files and extract financial actions.';
        const enrichedUserMessage = `<user_input>\n${safeUserMessage}\n</user_input>\n\n<system_notes>\n${driveUploadInfo}\n</system_notes>\n\n<chat_history>\n${contextBundle.historyContext}\n</chat_history>`;

        const aiResponse = await processMessage(
            enrichedUserMessage,
            contextBundle.context,
            contextBundle.budgetContext,
            today,
            contextBundle.profile ? {
                name: contextBundle.profile.name,
                currency: contextBundle.profile.currency,
                locale: contextBundle.profile.locale,
            } : undefined,
            attachments,
        );

        const actionResults: ActionResult[] = [];
        const storedTransactions: StoredTransaction[] = [];
        let toolCall: { name: string; parameters: Record<string, any>; executionId: number } | null = null;

        // Stage all mutation writes into verifiable action cards (zero unconfirmed writes)
        const hasMutations = (aiResponse.financialData && aiResponse.financialData.length > 0) ||
                             (aiResponse.actions && aiResponse.actions.length > 0);

        if (hasMutations) {
            // Determine primary staged tool call
            if (aiResponse.financialData && aiResponse.financialData.length > 0) {
                const first = aiResponse.financialData[0];
                const params = {
                    amount: first.amount,
                    type: first.type === 'earning' ? 'INCOME' : 'EXPENSE',
                    description: first.description,
                    categoryName: first.category,
                    date: first.date || today,
                };
                try {
                    const { db } = await import('@/db/client');
                    const { chatToolExecutions, agentActionLogs } = await import('@/db/schema');
                    const { randomUUID } = await import('crypto');

                    const [execution] = await db
                        .insert(chatToolExecutions)
                        .values({
                            userId,
                            toolName: 'createTransaction',
                            parametersJson: JSON.stringify(params),
                            status: 'pending',
                        })
                        .returning();

                    await db.insert(agentActionLogs).values({
                        id: `act_${randomUUID()}`,
                        userId,
                        sessionId: chatSessionId,
                        actionType: 'CREATE_TRANSACTION',
                        payloadJson: JSON.stringify(params),
                        status: 'PENDING_APPROVAL',
                    });

                    toolCall = {
                        name: 'createTransaction',
                        parameters: params,
                        executionId: execution.id,
                    };
                } catch (e) {
                    console.error('Failed to stage tool execution:', e);
                }
            } else if (aiResponse.actions && aiResponse.actions.length > 0) {
                const act = aiResponse.actions[0];
                let toolName = 'createTransaction';
                let params: Record<string, any> = {};

                if (act.target === 'transactions') {
                    toolName = 'createTransaction';
                    params = {
                        amount: act.updates?.amount || 0,
                        type: act.updates?.type === 'earning' ? 'INCOME' : 'EXPENSE',
                        description: act.updates?.description || 'Transaction',
                        categoryName: act.updates?.category || 'Other',
                        date: act.updates?.date || today,
                    };
                } else if (act.target === 'budgets') {
                    toolName = 'setBudgetLimit';
                    params = {
                        categoryName: act.updates?.category || act.filter?.category || 'Category',
                        monthlyLimit: act.updates?.monthly_limit || act.updates?.amount || 0,
                    };
                } else if (act.target === 'savings_goals') {
                    toolName = 'createSavingsGoal';
                    params = {
                        goalName: act.updates?.name || act.updates?.description || 'Goal',
                        targetAmount: act.updates?.amount || act.updates?.target_amount || 0,
                        targetDate: act.updates?.date,
                    };
                }

                if (params && Object.keys(params).length > 0) {
                    try {
                        const { db } = await import('@/db/client');
                        const { chatToolExecutions, agentActionLogs } = await import('@/db/schema');
                        const { randomUUID } = await import('crypto');

                        const [execution] = await db
                            .insert(chatToolExecutions)
                            .values({
                                userId,
                                toolName,
                                parametersJson: JSON.stringify(params),
                                status: 'pending',
                            })
                            .returning();

                        await db.insert(agentActionLogs).values({
                            id: `act_${randomUUID()}`,
                            userId,
                            sessionId: chatSessionId,
                            actionType: toolName.toUpperCase(),
                            payloadJson: JSON.stringify(params),
                            status: 'PENDING_APPROVAL',
                        });

                        toolCall = {
                            name: toolName,
                            parameters: params,
                            executionId: execution.id,
                        };
                    } catch (e) {
                        console.error('Failed to stage tool execution:', e);
                    }
                }
            }
        }

        let aiMessage = '';
        if (mode === 'chat') {
            aiMessage = aiResponse.message;
            await run(
                'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
                [userId, 'assistant', aiMessage, mode, chatSessionId]
            );
        } else if (hasMutations) {
            aiMessage = `Proposed action: please confirm to apply.`;
            await run(
                'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
                [userId, 'system', aiMessage, mode, chatSessionId]
            );
        }

        return NextResponse.json({
            message: mode === 'chat' ? aiMessage : (hasMutations ? aiMessage : ''),
            transactions: storedTransactions,
            actionResults,
            toolCall,
            pendingActions: hasMutations ? {
                financialData: aiResponse.financialData || [],
                actions: aiResponse.actions || [],
            } : null,
            attachmentSummaries: aiResponse.attachmentSummaries || attachments.map(a => ({
                name: a.name,
                summary: a.extractedText ? 'Text extracted and analyzed.' : 'Visual/document content analyzed by AI where supported.',
                confidence: a.extractedText || a.data ? 'medium' : 'low',
            })),
            snapshot: contextBundle.snapshot,
            isReportRequest: aiResponse.isReportRequest,
            reportFormat: aiResponse.reportFormat,
            reportType: aiResponse.reportType,
            dateRange: aiResponse.dateRange,
            sessionId: chatSessionId,
            mode,
        });
    }),
    { rateLimit: 'aiChat' }
);
