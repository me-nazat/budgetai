'use client';

import { create } from 'zustand';

interface CommandPaletteState { isOpen: boolean; open: () => void; close: () => void; toggle: () => void; }

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  isOpen: false, open: () => set({ isOpen: true }), close: () => set({ isOpen: false }), toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); useCommandPalette.getState().toggle(); }
  });
}
