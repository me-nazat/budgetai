'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  type AttachmentPreviewKind,
  type AttachmentViewerMetadata,
  formatFileSize,
} from '@/lib/transaction-attachments';

interface TransactionAttachmentViewerProps {
  fileToken: string;
  transactionSlug: string;
}

function getPreviewIcon(kind: AttachmentPreviewKind) {
  switch (kind) {
    case 'image': return 'image';
    case 'video': return 'videocam';
    case 'pdf': return 'description';
    default: return 'folder_zip';
  }
}

export default function TransactionAttachmentViewer({ fileToken, transactionSlug }: TransactionAttachmentViewerProps) {
  const router = useRouter();
  const pdfRef = useRef<HTMLIFrameElement>(null);
  const [metadata, setMetadata] = useState<AttachmentViewerMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/files/${encodeURIComponent(fileToken)}?meta=1`, { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as AttachmentViewerMetadata | { error?: string } | null;

        if (!res.ok) {
          throw new Error(payload && 'error' in payload ? payload.error || 'Unable to open this file.' : 'Unable to open this file.');
        }

        if (!cancelled && payload && 'id' in payload) {
          setMetadata(payload);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to open this file.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [fileToken]);

  const previewIcon = getPreviewIcon(metadata?.previewKind ?? 'unsupported');
  const title = metadata?.name ?? 'Attachment Viewer';
  const subtitle = metadata
    ? `${formatFileSize(metadata.size)} · ${transactionSlug.replace(/-/g, ' ')}`
    : transactionSlug.replace(/-/g, ' ');

  const handleClose = () => {
    if (window.history.length > 1) { router.back(); return; }
    router.push('/transactions');
  };

  const handlePrint = () => {
    if (!metadata?.printable) return;

    if (metadata.previewKind === 'pdf') {
      pdfRef.current?.contentWindow?.print();
      return;
    }

    if (metadata.previewKind === 'image') {
      const win = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
      if (!win) return;
      win.document.write(`
        <html>
          <head>
            <title>${metadata.name}</title>
            <style>
              html, body { margin: 0; background: #0a0a0a; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${metadata.viewUrl}" alt="${metadata.name}" />
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.onload = () => win.print();
    }
  };

  const preview = useMemo(() => {
    if (!metadata) return null;

    switch (metadata.previewKind) {
      case 'image':
        return (
          <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-2xl backdrop-blur-sm">
            <img
              src={metadata.viewUrl}
              alt={metadata.name}
              className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        );
      case 'video':
        return (
          <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-3 shadow-2xl">
            <video
              controls
              playsInline
              className="h-full max-h-full w-full rounded-xl bg-black object-contain"
              src={metadata.viewUrl}
            />
          </div>
        );
      case 'pdf':
        return (
          <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
            <iframe
              ref={pdfRef}
              title={metadata.name}
              src={metadata.viewUrl}
              className="h-full w-full"
            />
          </div>
        );
      default:
        return (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-8 py-10 text-center shadow-2xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 text-white/70">
              <span className="material-symbols-outlined text-4xl">{previewIcon}</span>
            </div>
            <h2 className="mt-6 text-xl font-bold text-white">Preview unavailable</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-400">
              This file type is stored securely but can&apos;t be rendered inline in the browser.
            </p>
            <a
              href={metadata.downloadUrl}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-gray-900 transition-all active:scale-95 hover:bg-gray-100"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download File
            </a>
          </div>
        );
    }
  }, [metadata, previewIcon]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.15),transparent_35%),linear-gradient(180deg,#020617_0%,#0a0a0a_40%,#111_100%)] px-3 py-3 text-white sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1580px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-950/70 shadow-2xl backdrop-blur-2xl sm:min-h-[calc(100vh-2.5rem)] sm:rounded-3xl">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-gray-950/80 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 transition-all active:scale-95 hover:bg-white/5 hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back to Wealth AI
              </button>
              <div className="mt-2 min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">{title}</h1>
                <p className="mt-0.5 truncate text-sm text-gray-400">{subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {metadata?.printable ? (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all active:scale-95 hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Print
                </button>
              ) : null}

              {metadata ? (
                <a
                  href={metadata.downloadUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-900 transition-all active:scale-95 hover:bg-gray-100"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download
                </a>
              ) : null}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
          {isLoading ? (
            <div className="flex min-h-[70vh] items-center justify-center">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-gray-300">
                <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                Loading file preview...
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[70vh] items-center justify-center">
              <div className="w-full max-w-lg rounded-2xl border border-rose-400/20 bg-rose-500/10 px-6 py-7 text-center shadow-2xl">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
                  <span className="material-symbols-outlined text-3xl">error</span>
                </div>
                <h2 className="mt-5 text-xl font-bold text-white">Unable to open this file</h2>
                <p className="mt-3 text-sm leading-relaxed text-rose-200/80">{error}</p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all active:scale-95 hover:bg-white/5"
                  >
                    Go Back
                  </button>
                  <a
                    href="/transactions"
                    className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-900 transition-all active:scale-95 hover:bg-gray-100"
                  >
                    Open Transactions
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className={`min-h-[70vh] ${metadata?.previewKind === 'unsupported' ? 'flex items-center justify-center' : 'h-[calc(100vh-11rem)] sm:h-[calc(100vh-12rem)]'}`}>
              {preview}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
