'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  MAX_ATTACHMENT_FILES,
  MAX_ATTACHMENT_SIZE_BYTES,
  type AttachmentRecord,
  type AttachmentsResponse,
  buildAttachmentViewerHref,
  formatFileSize,
} from '@/lib/transaction-attachments';

interface TransactionAttachmentsSectionProps {
  transactionId: number;
  transactionDescription: string;
}

type NoticeTone = 'error' | 'success' | 'info';

interface UploadNotice {
  tone: NoticeTone;
  message: string;
}

interface UploadProgressState {
  current: number;
  total: number;
  fileName: string;
}

function pickFileIcon(mimeType: string | null, fileName: string) {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'videocam';
  if (mimeType?.includes('pdf') || mimeType?.includes('document') || mimeType?.includes('text') || fileName.match(/\.(docx?|pdf|txt|md|rtf)$/i)) return 'description';
  if (mimeType?.includes('zip') || mimeType?.includes('compressed') || fileName.match(/\.(zip|rar|7z|tar|gz)$/i)) return 'folder_zip';
  if (mimeType?.includes('spreadsheet') || fileName.match(/\.(xlsx?|csv)$/i)) return 'table_chart';
  return 'attach_file';
}

function mergeAttachments(next: AttachmentRecord[], current: AttachmentRecord[]) {
  const deduped = new Map<string, AttachmentRecord>();
  [...next, ...current].forEach((f) => deduped.set(f.id, f));
  return Array.from(deduped.values()).sort((a, b) => {
    const at = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
    const bt = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
    return bt - at;
  });
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const noticeClasses: Record<NoticeTone, string> = {
  error: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

export default function TransactionAttachmentsSection({
  transactionId,
  transactionDescription,
}: TransactionAttachmentsSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [progress, setProgress] = useState<UploadProgressState | null>(null);

  const remainingSlots = Math.max(0, MAX_ATTACHMENT_FILES - attachments.length);
  const constraintsCopy = useMemo(
    () => `Max ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))}MB per file · Up to ${MAX_ATTACHMENT_FILES} files`,
    [],
  );

  const showNotice = useCallback((tone: NoticeTone, message: string) => {
    setNotice({ tone, message });
  }, []);

  const fetchAttachments = useCallback(
    async (silent?: boolean) => {
      if (!silent) setIsLoading(true);
      try {
        const res = await fetch(`/api/transactions/${transactionId}/attachments`, { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as AttachmentsResponse | { error?: string } | null;
        if (!res.ok) throw new Error(payload && 'error' in payload ? payload.error || 'Unable to load.' : 'Unable to load.');
        if (payload && 'files' in payload) setAttachments(payload.files);
      } catch (e) {
        showNotice('error', e instanceof Error ? e.message : 'Unable to load attachments.');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [showNotice, transactionId],
  );

  useEffect(() => {
    setAttachments([]);
    setNotice(null);
    setProgress(null);
    void fetchAttachments();
  }, [fetchAttachments, transactionId]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const uploadFiles = useCallback(
    async (candidates: File[]) => {
      if (!candidates.length) return;

      const oversized = candidates.filter((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
      const valid = candidates.filter((f) => f.size <= MAX_ATTACHMENT_SIZE_BYTES);

      if (oversized.length > 0) {
        showNotice('error', oversized.length === 1
          ? `"${oversized[0].name}" exceeds the 100MB limit.`
          : `${oversized.length} files exceed the 100MB limit and were skipped.`);
      }
      if (!valid.length) return;
      if (attachments.length + valid.length > MAX_ATTACHMENT_FILES) {
        showNotice('error', `You can attach up to ${MAX_ATTACHMENT_FILES} files.`);
        return;
      }

      setIsUploading(true);
      const uploaded: AttachmentRecord[] = [];
      const failed: string[] = [];

      for (const [i, file] of valid.entries()) {
        setProgress({ current: i, total: valid.length, fileName: file.name });

        const form = new FormData();
        form.append('files', file);

        try {
          const res = await fetch(`/api/transactions/${transactionId}/attachments`, { method: 'POST', body: form });
          const payload = (await res.json().catch(() => null)) as (AttachmentsResponse & { error?: string }) | { error?: string } | null;
          if (!res.ok) throw new Error(payload && 'error' in payload ? payload.error || `Upload failed: ${file.name}` : `Upload failed: ${file.name}`);

          if (payload && 'files' in payload) {
            const next = payload.files.slice(0, 1);
            uploaded.push(...next);
            setAttachments((cur) => mergeAttachments(next, cur));
          }
          setProgress({ current: i + 1, total: valid.length, fileName: file.name });
        } catch (e) {
          failed.push(e instanceof Error ? e.message : `Upload failed: ${file.name}`);
        }
      }

      setIsUploading(false);
      setProgress(null);
      if (uploaded.length > 0) await fetchAttachments(true);

      if (uploaded.length > 0 && failed.length === 0) {
        showNotice('success', uploaded.length === 1 ? '1 file attached.' : `${uploaded.length} files attached.`);
      } else if (uploaded.length > 0 && failed.length > 0) {
        showNotice('info', `Uploaded ${uploaded.length} files, ${failed.length} failed.`);
      } else if (failed.length > 0) {
        showNotice('error', failed[0]);
      }
    },
    [attachments.length, fetchAttachments, showNotice, transactionId],
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      e.target.value = '';
      await uploadFiles(selected);
    },
    [uploadFiles],
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-1">
        <span className="material-symbols-outlined text-[18px] text-primary/60">attach_file</span>
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Receipts & Attachments
        </span>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {attachments.length}/{MAX_ATTACHMENT_FILES}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#30363d] dark:bg-[#161b22] sm:p-5">
        <div className="flex flex-col gap-3">
          {/* Constraints + Button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">{constraintsCopy}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading || remainingSlots === 0}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
                isUploading || remainingSlots === 0
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{isUploading ? 'sync' : 'cloud_upload'}</span>
              {isUploading ? 'Uploading...' : 'Attach Files'}
            </button>
          </div>

          <input ref={inputRef} type="file" multiple onChange={handleFileChange} className="hidden" />

          {/* Drop Zone */}
          <div
            role="presentation"
            onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); if (!isUploading) setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (isUploading) return;
              void uploadFiles(Array.from(e.dataTransfer.files ?? []));
            }}
            className={`relative overflow-hidden rounded-xl border border-dashed px-4 py-4 transition-all ${
              isDragging
                ? 'border-primary/40 bg-primary/5 shadow-inner'
                : 'border-gray-300 bg-gray-50/50 dark:border-[#30363d] dark:bg-[#0d1117]/30'
            }`}
          >
            {/* Radial gradient overlay */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.06),transparent_60%)]" />
            <div className="relative flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <span className="material-symbols-outlined text-[18px] text-primary/60">cloud_upload</span>
                  Drop files here or use the picker
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-500">
                  Upload receipts, invoices, or supporting documents
                </p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading || remainingSlots === 0}
                className={`flex items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                  isUploading || remainingSlots === 0
                    ? 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                    : 'bg-white text-primary shadow-sm hover:bg-primary/5 dark:bg-[#21262d] dark:hover:bg-[#30363d]'
                }`}
              >
                {remainingSlots === 0 ? 'Limit Reached' : 'Browse Files'}
              </button>
            </div>
          </div>

          {/* Notice */}
          <AnimatePresence initial={false}>
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-sm ${noticeClasses[notice.tone]}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {notice.tone === 'success' ? 'check_circle' : notice.tone === 'error' ? 'error' : 'info'}
                </span>
                <span className="text-xs font-semibold">{notice.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload Progress */}
          {isUploading && progress && (
            <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 px-3.5 py-2.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-primary/70">
                <span>Uploading</span>
                <span>{Math.min(progress.current + 1, progress.total)}/{progress.total}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.max(8, (Math.min(progress.current, progress.total) / progress.total) * 100)}%` }}
                />
              </div>
              <p className="truncate text-xs text-primary/75">{progress.fileName}</p>
            </div>
          )}

          {/* File List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 px-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-500">
                Attached Files
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                {remainingSlots} slots left
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-400 dark:bg-[#0d1117]/40">
                <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                Loading files...
              </div>
            ) : attachments.length === 0 ? (
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-400 dark:bg-[#0d1117]/40">
                No files attached yet. Upload receipts, invoices, or documents to this transaction.
              </div>
            ) : (
              <div className="space-y-1.5">
                {attachments.map((file) => {
                  const icon = pickFileIcon(file.mimeType, file.name);
                  const href = buildAttachmentViewerHref(transactionDescription, transactionId, file.id);
                  return (
                    <div
                      key={file.id}
                      className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-primary/20 hover:shadow-md dark:border-[#30363d] dark:bg-[#161b22] dark:hover:border-primary/30"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary/70">
                        <span className="material-symbols-outlined text-[20px]">{icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                          {file.name}
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                          {formatFileSize(file.size)}
                          {file.modifiedTime ? ` · ${timeAgo(file.modifiedTime)}` : ''}
                        </p>
                      </div>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 transition-all active:scale-95 hover:border-primary/20 hover:bg-primary/5 hover:text-primary dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-400 dark:hover:text-primary"
                      >
                        Open
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
