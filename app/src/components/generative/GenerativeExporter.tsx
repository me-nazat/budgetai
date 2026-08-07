'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';

interface GenerativeExporterProps {
  children?: React.ReactNode;
  filename?: string;
  className?: string;
  targetId?: string;
}

export default function GenerativeExporter({ children, filename = 'financial-art', className = '', targetId }: GenerativeExporterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const downloadSvg = () => {
    let svgElement: SVGSVGElement | null = null;
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) svgElement = target.querySelector('svg');
    } else if (containerRef.current) {
      svgElement = containerRef.current.querySelector('svg');
    }
    if (!svgElement) return;

    // Serialize SVG
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    
    // Add namespace if missing
    let finalSource = source;
    if (!finalSource.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      finalSource = finalSource.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const blob = new Blob([finalSource], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    let svgElement: SVGSVGElement | null = null;
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) svgElement = target.querySelector('svg');
    } else if (containerRef.current) {
      svgElement = containerRef.current.querySelector('svg');
    }
    if (!svgElement) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = parseInt(svgElement.getAttribute('width') || '800');
    const height = parseInt(svgElement.getAttribute('height') || '400');
    
    // Support higher resolution for PNG
    const scale = 2; 
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const img = new Image();
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.src = url;
  };

  return (
    <div className={`relative group ${className}`}>
      {children && (
        <div ref={containerRef} className="w-full h-full">
          {children}
        </div>
      )}
      
      {/* Export Controls (visible on hover) */}
      <motion.div 
        className={`${children ? 'absolute bottom-4 right-4 opacity-0 group-hover:opacity-100' : ''} flex gap-2 transition-opacity`}
        initial={{ y: children ? 10 : 0 }}
        whileHover={{ y: 0 }}
      >
        <button 
          onClick={downloadSvg}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">data_object</span>
          SVG
        </button>
        <button 
          onClick={downloadPng}
          className="bg-primary/80 hover:bg-primary text-white backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">image</span>
          PNG
        </button>
      </motion.div>
    </div>
  );
}
