import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { run } from '@/lib/db';
import { AttachmentInput, processMessage } from '@/lib/ai';
import { getFinancialContextBundle } from '@/lib/financialContext';
import { ActionResult, StoredTransaction, processDataActions, storeFinancialData } from '@/lib/chatActions';

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
        hasAttachments: attachments.length > 0,
    };
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, mode, sessionId, attachments, hasAttachments } = await parseChatRequest(request);
        if (!message && attachments.length === 0) {
            return NextResponse.json({ error: 'Message or attachment is required' }, { status: 400 });
        }

        const chatSessionId = sessionId || `session_${Date.now()}`;
        const today = new Date().toISOString().split('T')[0];
        const attachmentNames = attachments.map(a => a.name).join(', ');
        const userContent = attachmentNames ? `${message || 'Analyze these attachments.'}\n\nAttachments: ${attachmentNames}` : message;

        await run(
            'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
            [session.userId, 'user', userContent, mode, chatSessionId]
        );

        const contextBundle = await getFinancialContextBundle(session.userId, chatSessionId);
        const aiResponse = await processMessage(
            `${message || 'Analyze the attached files and extract financial actions.'}${contextBundle.historyContext}`,
            contextBundle.context,
            contextBundle.budgetContext,
            today,
            contextBundle.profile ? { name: contextBundle.profile.name, currency: contextBundle.profile.currency } : undefined,
            attachments,
        );

        let actionResults: ActionResult[] = [];
        let storedTransactions: StoredTransaction[] = [];

        if (!hasAttachments) {
            if (aiResponse.actions?.length) {
                actionResults = await processDataActions(aiResponse.actions, session.userId);
            }
            if (aiResponse.financialData?.length) {
                storedTransactions = await storeFinancialData(aiResponse.financialData, session.userId, today, contextBundle.currencySymbol);
            }
        }

        let aiMessage = '';
        if (mode === 'chat') {
            aiMessage = aiResponse.message;
            await run(
                'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
                [session.userId, 'assistant', aiMessage, mode, chatSessionId]
            );
        } else if (!hasAttachments && (storedTransactions.length > 0 || actionResults.length > 0)) {
            const parts: string[] = [];
            if (storedTransactions.length > 0) {
                parts.push(storedTransactions.map(t => `${t.type}: ${contextBundle.currencySymbol}${t.amount} (${t.category})`).join(', '));
            }
            if (actionResults.length > 0) parts.push(actionResults.map(r => r.detail).join(', '));
            aiMessage = `Saved: ${parts.join(' | ')}`;
            await run(
                'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
                [session.userId, 'system', aiMessage, mode, chatSessionId]
            );
        }

        return NextResponse.json({
            message: hasAttachments
                ? aiResponse.message || 'I reviewed the attachment. Confirm the proposed items before I save them.'
                : mode === 'chat' ? aiMessage : (storedTransactions.length > 0 || actionResults.length > 0 ? aiMessage : ''),
            transactions: storedTransactions,
            actionResults,
            pendingActions: hasAttachments ? {
                financialData: aiResponse.financialData || [],
                actions: aiResponse.actions || [],
            } : null,
            attachmentSummaries: aiResponse.attachmentSummaries || attachments.map(a => ({
                name: a.name,
                summary: a.extractedText ? 'Text extracted and analyzed.' : 'Visual/document content analyzed by AI where supported.',
                confidence: a.extractedText || a.data ? 'medium' : 'low',
            })),
            isReportRequest: aiResponse.isReportRequest,
            reportFormat: aiResponse.reportFormat,
            reportType: aiResponse.reportType,
            dateRange: aiResponse.dateRange,
            sessionId: chatSessionId,
            mode,
        });
    } catch (error) {
        console.error('Chat error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
