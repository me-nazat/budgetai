'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

export interface GenerativeExporterProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  filenamePrefix?: string;
  className?: string;
  showResolutionSelector?: boolean;
}

export const GenerativeExporter: React.FC<GenerativeExporterProps> = ({
  svgRef,
  filenamePrefix = 'wealth-ai-generative-art',
  className = '',
  showResolutionSelector = true,
}) => {
  const [resolutionScale, setResolutionScale] = useState<number>(2); // 1x, 2x (Retina), 4x (Ultra 4K)
  const [darkBackdrop, setDarkBackdrop] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  /**
   * Prepares and serializes the SVG into a standalone valid XML string.
   */
  const getSerializedSvgString = (): string | null => {
    const svgEl = svgRef.current;
    if (!svgEl) {
      toast.error('Generative canvas not ready for export');
      return null;
    }

    const cloned = svgEl.cloneNode(true) as SVGSVGElement;
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    cloned.setAttribute('version', '1.1');

    return new XMLSerializer().serializeToString(cloned);
  };

  /**
   * Trigger direct vector SVG download.
   */
  const handleDownloadSvg = () => {
    const svgString = getSerializedSvgString();
    if (!svgString) return;

    try {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenamePrefix}-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Vector SVG downloaded successfully!');
    } catch (err) {
      console.error('Failed to export SVG', err);
      toast.error('Failed to download SVG file.');
    }
  };

  /**
   * Render SVG onto an off-screen HTML5 canvas at high DPI and export PNG.
   */
  const handleDownloadPng = async () => {
    const svgString = getSerializedSvgString();
    const svgEl = svgRef.current;
    if (!svgString || !svgEl) return;

    setIsExporting(true);
    try {
      // Determine base dimensions from viewBox or bounding rect
      const viewBox = svgEl.viewBox?.baseVal;
      const baseWidth = viewBox && viewBox.width > 0 ? viewBox.width : svgEl.clientWidth || 600;
      const baseHeight = viewBox && viewBox.height > 0 ? viewBox.height : svgEl.clientHeight || 600;

      const targetWidth = Math.round(baseWidth * resolutionScale);
      const targetHeight = Math.round(baseHeight * resolutionScale);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context could not be initialized');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Optional dark canvas background for luminescent vector visibility
      if (darkBackdrop) {
        ctx.fillStyle = '#0a0e17'; // Deep obsidian
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // Convert SVG string to base64 Data URI for cross-browser img loading
      const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          resolve();
        };
        img.onerror = (e) => reject(e);
        img.src = svgBase64;
      });

      // Export Canvas to PNG Blob
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('PNG rasterization failed.');
          setIsExporting(false);
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const resolutionLabel = resolutionScale === 1 ? '1x' : resolutionScale === 2 ? 'Retina-2x' : 'Ultra-4K';
        a.download = `${filenamePrefix}-${resolutionLabel}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${resolutionLabel} PNG (${targetWidth}×${targetHeight}px)!`);
        setIsExporting(false);
      }, 'image/png');
    } catch (err) {
      console.error('PNG rasterization error', err);
      toast.error('Error generating raster PNG.');
      setIsExporting(false);
    }
  };

  /**
   * Copy raw SVG markup to clipboard.
   */
  const handleCopySvg = async () => {
    const svgString = getSerializedSvgString();
    if (!svgString) return;

    try {
      await navigator.clipboard.writeText(svgString);
      toast.success('SVG markup copied to clipboard!');
    } catch (err) {
      console.error('Clipboard copy error', err);
      toast.error('Could not copy to clipboard.');
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-white/70 dark:bg-gray-900/70 border border-gray-200/60 dark:border-white/10 backdrop-blur-xl shadow-lg ${className}`}
    >
      {/* Resolution Selector */}
      {showResolutionSelector && (
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-black/40 p-1 rounded-xl border border-gray-200/40 dark:border-white/5">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-2 select-none">
            Res:
          </span>
          {[
            { scale: 1, label: '1x' },
            { scale: 2, label: '2x HD' },
            { scale: 4, label: '4K Ultra' },
          ].map((item) => (
            <button
              key={item.scale}
              type="button"
              onClick={() => setResolutionScale(item.scale)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                resolutionScale === item.scale
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Dark backdrop toggle for PNG */}
      <button
        type="button"
        onClick={() => setDarkBackdrop(!darkBackdrop)}
        title={darkBackdrop ? 'PNG has dark obsidian background' : 'PNG has transparent background'}
        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 border cursor-pointer ${
          darkBackdrop
            ? 'bg-gray-900 dark:bg-black text-amber-400 border-amber-500/30'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-white/10'
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">
          {darkBackdrop ? 'dark_mode' : 'contrast'}
        </span>
        <span>{darkBackdrop ? 'Obsidian Base' : 'Transparent'}</span>
      </button>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={handleCopySvg}
          title="Copy SVG to clipboard"
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">content_copy</span>
          <span>Copy</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadSvg}
          title="Download vector SVG"
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          <span>Download SVG</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPng}
          disabled={isExporting}
          title="Download raster PNG"
          className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-md shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">
            {isExporting ? 'sync' : 'image'}
          </span>
          <span>{isExporting ? 'Rendering...' : 'Export PNG'}</span>
        </button>
      </div>
    </div>
  );
};

export default GenerativeExporter;
