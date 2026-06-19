'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

import {
  type AttachmentPreviewKind,
  type AttachmentViewerMetadata,
  formatFileSize,
} from '@/lib/transaction-attachments';

const spring = { type: 'spring' as const, stiffness: 380, damping: 32 };

interface AttachmentPreviewModalProps {
  fileToken: string | null;
  contextTitle: string;
  fallbackName?: string;
  onClose: () => void;
}

function getPreviewIcon(kind: AttachmentPreviewKind) {
  switch (kind) {
    case 'image': return 'image';
    case 'video': return 'videocam';
    case 'pdf': return 'description';
    default: return 'folder_zip';
  }
}

export default function AttachmentPreviewModal({
  fileToken,
  contextTitle,
  fallbackName = 'Attachment',
  onClose,
}: AttachmentPreviewModalProps) {
  const pdfRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [metadata, setMetadata] = useState<AttachmentViewerMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!fileToken) {
      setMetadata(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setMetadata(null);

    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(`/api/files/${encodeURIComponent(fileToken)}?meta=1`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await res.json().catch(() => null)) as AttachmentViewerMetadata | { error?: string } | null;

        if (!res.ok) {
          throw new Error(payload && 'error' in payload ? payload.error || 'Unable to open this file.' : 'Unable to open this file.');
        }

        if (!cancelled && payload && 'id' in payload) setMetadata(payload);
      } catch (e) {
        if (!cancelled && !(e instanceof DOMException && e.name === 'AbortError')) {
          setError(e instanceof Error ? e.message : 'Unable to open this file.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fileToken]);

  useEffect(() => {
    if (!fileToken) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fileToken, onClose]);

  const title = metadata?.name ?? fallbackName;
  const subtitle = metadata ? `${contextTitle} / ${formatFileSize(metadata.size)}` : contextTitle;
  const previewIcon = getPreviewIcon(metadata?.previewKind ?? 'unsupported');

  const preview = useMemo(() => {
    if (!metadata) return null;

    switch (metadata.previewKind) {
      case 'image':
        return (
          <div className="flex h-full min-h-0 items-center justify-center bg-black">
            <img
              src={metadata.viewUrl}
              alt={metadata.name}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>
        );
      case 'video':
        return (
          <div className="flex h-full min-h-0 items-center justify-center bg-black">
            <video
              controls
              playsInline
              preload="metadata"
              className="h-full max-h-full w-full bg-black object-contain"
              src={metadata.viewUrl}
            />
          </div>
        );
      case 'pdf':
        return (
          <div className="h-full min-h-0 bg-white">
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
          <div className="flex h-full min-h-0 flex-col items-center justify-center bg-gray-950 px-6 text-center text-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <span className="material-symbols-outlined text-3xl">{previewIcon}</span>
            </div>
            <h3 className="mt-5 text-lg font-bold">Preview unavailable</h3>
            <a
              href={metadata.downloadUrl}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-gray-900 transition active:scale-95 hover:bg-gray-100"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download
            </a>
          </div>
        );
    }
  }, [metadata, previewIcon]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {fileToken ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5">
          <motion.button
            type="button"
            aria-label="Close preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={spring}
            className="relative z-[81] flex h-[80dvh] w-[80vw] min-w-[min(80vw,20rem)] max-w-[1280px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-950 text-white shadow-2xl"
          >
            <header className="flex min-h-16 items-center gap-3 border-b border-white/10 bg-gray-950/95 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold uppercase tracking-widest text-gray-400">{subtitle}</p>
                <h2 className="mt-0.5 truncate text-base font-black text-white sm:text-lg">{title}</h2>
              </div>
              {metadata ? (
                <a
                  href={metadata.downloadUrl}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 hover:bg-white/15"
                  title="Download"
                >
                  <span className="material-symbols-outlined text-[20px]">download</span>
                </a>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 hover:bg-white/15"
                title="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex h-full items-center justify-center bg-gray-950">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300">
                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                    Loading preview...
                  </div>
                </div>
              ) : error ? (
                <div className="flex h-full items-center justify-center bg-gray-950 px-6 text-center">
                  <div className="max-w-md">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
                      <span className="material-symbols-outlined text-3xl">error</span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-white">Unable to open this file</h3>
                    <p className="mt-2 text-sm leading-relaxed text-rose-200/80">{error}</p>
                  </div>
                </div>
              ) : (
                preview
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
