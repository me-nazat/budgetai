'use client';

import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard } from '@/hooks/useApi';
import FinancialMandala, { GenerativePalette } from '@/components/generative/FinancialMandala';
import DataRiverChart from '@/components/generative/DataRiverChart';
import GenerativeExporter from '@/components/generative/GenerativeExporter';
import { CATEGORY_HEX_COLORS } from '@/lib/categoryUtils';

type ArtMode = 'mandala' | 'river' | 'dual';

export default function GenerativeArtPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data, isLoading } = useDashboard(currentMonth, 'all');

  const [artMode, setArtMode] = useState<ArtMode>('mandala');
  const [palette, setPalette] = useState<GenerativePalette>('gold');
  const [symmetry, setSymmetry] = useState<number>(8);
  const [complexity, setComplexity] = useState<number>(3);
  const [rotationSpeed, setRotationSpeed] = useState<number>(60);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // SVG refs for the exporter
  const mandalaSvgRef = useRef<SVGSVGElement | null>(null);
  const riverSvgRef = useRef<SVGSVGElement | null>(null);

  const activeSvgRef = artMode === 'river' ? riverSvgRef : mandalaSvgRef;

  const categorySpending = data?.categorySpending || [];
  const dailySpending = data?.dailySpending || [];
  const balance = data?.balance || 0;
  const savingsRate =
    data?.earnings?.current && data.earnings.current > 0
      ? Math.max(0, Math.min(1, data.netSavings / data.earnings.current))
      : 0.25;

  const totalSpent = useMemo(
    () => categorySpending.reduce((acc, c) => acc + (c.total || 0), 0),
    [categorySpending]
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 text-2xl animate-pulse">
              all_inclusive
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Data-Storytelling Studio
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-white">
            Generative Financial Art
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
            Translates your financial telemetry, category allocations, and cash flows into unique
            sacred mathematical topologies and organic waveforms.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-gray-100 dark:bg-surface-dark border border-gray-200/60 dark:border-white/10 self-start md:self-auto shadow-inner">
          {[
            { id: 'mandala', label: 'Mandala Topology', icon: 'cyclone' },
            { id: 'river', label: 'Data River Flow', icon: 'water' },
            { id: 'dual', label: 'Synchronized', icon: 'splitscreen' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setArtMode(mode.id as ArtMode)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                artMode === mode.id
                  ? 'bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm scale-[1.02]'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Canvas Showcase */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-gray-900 via-gray-950 to-black text-white overflow-hidden shadow-2xl border border-white/10 flex flex-col items-center justify-center min-h-[500px]">
            {/* Ambient Background Grid Pattern */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Top Toolbar overlay on Canvas */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-auto">
              <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-gray-300 border border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Real-Time Financial Telemetry</span>
              </div>

              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                title="View Fullscreen"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">fullscreen</span>
              </button>
            </div>

            {/* Artwork Renderers */}
            <div className="w-full flex flex-col items-center justify-center py-6">
              {artMode === 'mandala' && (
                <FinancialMandala
                  svgRef={mandalaSvgRef}
                  categorySpending={categorySpending}
                  balance={balance}
                  savingsRate={savingsRate}
                  palette={palette}
                  symmetry={symmetry}
                  complexity={complexity}
                  rotationSpeed={rotationSpeed}
                  interactive={true}
                  size={460}
                  onSelectCategory={(cat) => setSelectedCategory(cat)}
                  className="transition-transform duration-500 hover:scale-[1.02]"
                />
              )}

              {artMode === 'river' && (
                <div className="w-full max-w-2xl px-2">
                  <DataRiverChart
                    svgRef={riverSvgRef}
                    dailySpending={dailySpending}
                    palette={palette}
                    height={380}
                    interactive={true}
                  />
                </div>
              )}

              {artMode === 'dual' && (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="flex flex-col items-center">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                      Topology Signature
                    </p>
                    <FinancialMandala
                      svgRef={mandalaSvgRef}
                      categorySpending={categorySpending}
                      balance={balance}
                      savingsRate={savingsRate}
                      palette={palette}
                      symmetry={symmetry}
                      complexity={complexity}
                      rotationSpeed={rotationSpeed}
                      size={280}
                      interactive={true}
                    />
                  </div>
                  <div className="flex flex-col items-center w-full">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                      Continuous Cash Waveform
                    </p>
                    <DataRiverChart
                      svgRef={riverSvgRef}
                      dailySpending={dailySpending}
                      palette={palette}
                      height={240}
                      interactive={true}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Bottom Details */}
            <div className="w-full mt-auto pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
              <div className="flex items-center gap-4">
                <span>
                  Categories:{' '}
                  <strong className="text-white">
                    {categorySpending.length > 0 ? categorySpending.length : 'Baseline (12)'}
                  </strong>
                </span>
                <span>
                  Savings Rate:{' '}
                  <strong className="text-emerald-400">{(savingsRate * 100).toFixed(0)}%</strong>
                </span>
              </div>
              <span className="text-[10px] text-gray-500">
                Continuous GPU-Accelerated Vector Topology
              </span>
            </div>
          </div>

          {/* Exporter Bar */}
          <GenerativeExporter
            svgRef={activeSvgRef}
            filenamePrefix={`wealth-ai-${artMode}`}
            className="w-full"
          />
        </div>

        {/* Right: Studio Customizer Controls */}
        <div className="lg:col-span-4 space-y-5">
          {/* Palette Selector */}
          <div className="rounded-3xl p-5 bg-white dark:bg-surface-dark border border-gray-200/60 dark:border-white/5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Harmonic Color Palette
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: 'gold',
                  name: 'Obsidian & Gold',
                  colors: ['#f59e0b', '#fbbf24', '#78350f'],
                },
                {
                  id: 'emerald',
                  name: 'Emerald Canopy',
                  colors: ['#10b981', '#34d399', '#064e3b'],
                },
                {
                  id: 'sapphire',
                  name: 'Sapphire Drift',
                  colors: ['#0ea5e9', '#38bdf8', '#0c4a6e'],
                },
                {
                  id: 'solar',
                  name: 'Solar Amber',
                  colors: ['#f97316', '#fb923c', '#7c2d12'],
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPalette(p.id as GenerativePalette)}
                  className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col gap-2 ${
                    palette === p.id
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                      : 'border-gray-200/60 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {p.colors.map((c, i) => (
                      <span
                        key={i}
                        className="w-3.5 h-3.5 rounded-full shadow-xs"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Mathematical Geometry Parameters */}
          <div className="rounded-3xl p-5 bg-white dark:bg-surface-dark border border-gray-200/60 dark:border-white/5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Geometry Topology Parameters
            </h3>

            {/* Symmetry Folds */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Symmetry Folds</span>
                <span className="font-bold text-gray-900 dark:text-white">{symmetry}-fold</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[4, 6, 8, 12].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSymmetry(f)}
                    className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      symmetry === f
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm'
                        : 'border-gray-200/80 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Complexity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  Harmonic Tier Complexity
                </span>
                <span className="font-bold text-gray-900 dark:text-white">Tier {complexity}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={complexity}
                onChange={(e) => setComplexity(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Minimal</span>
                <span>Balanced</span>
                <span>Hyper-Dense</span>
              </div>
            </div>

            {/* Rotation Motion */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  Continuous Rotation Speed
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {rotationSpeed === 0 ? 'Paused' : `${rotationSpeed}s / rev`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { speed: 0, label: 'Pause' },
                  { speed: 120, label: 'Subtle' },
                  { speed: 60, label: 'Medium' },
                  { speed: 30, label: 'Dynamic' },
                ].map((item) => (
                  <button
                    key={item.speed}
                    type="button"
                    onClick={() => setRotationSpeed(item.speed)}
                    className={`py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      rotationSpeed === item.speed
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm'
                        : 'border-gray-200/80 dark:border-white/10 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Category Topology Telemetry */}
          <div className="rounded-3xl p-5 bg-white dark:bg-surface-dark border border-gray-200/60 dark:border-white/5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Harmonic Category Weighting
            </h3>
            {categorySpending.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {categorySpending.slice(0, 8).map((cat) => {
                  const share = totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0;
                  const catColor = CATEGORY_HEX_COLORS[cat.category] || '#f59e0b';
                  const isSelected = selectedCategory === cat.category;

                  return (
                    <div
                      key={cat.category}
                      onClick={() => setSelectedCategory(isSelected ? null : cat.category)}
                      className={`p-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-gray-100 dark:bg-white/10 font-bold'
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: catColor }}
                        />
                        <span className="text-gray-800 dark:text-gray-200">{cat.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-[11px]">{share.toFixed(0)}%</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ${cat.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 leading-relaxed">
                Using Fibonacci sacred harmonic baseline geometry. As you record transactions,
                each category will emerge as a distinct vector petal.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Showcase Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6"
          >
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>

            <div className="w-full max-w-3xl flex flex-col items-center">
              <FinancialMandala
                categorySpending={categorySpending}
                balance={balance}
                savingsRate={savingsRate}
                palette={palette}
                symmetry={symmetry}
                complexity={complexity}
                rotationSpeed={rotationSpeed}
                size={Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.8 : 600, 600)}
                interactive={true}
              />
              <p className="text-xs text-gray-400 mt-6 tracking-widest uppercase">
                {palette.toUpperCase()} SPECTRUM &bull; {symmetry}-FOLD TOPOLOGY
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
