'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NLInput from './NLInput';

export default function FloatingActionButton() {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* Overlay */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] lg:hidden"
                        onClick={() => setOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Quick Add Panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed bottom-24 left-4 right-4 z-[61] lg:hidden"
                    >
                        <div className="rounded-2xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        bolt
                                    </span>
                                    Quick Add
                                </h3>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-400"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>
                            <NLInput />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB Button */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.5 }}
                onClick={() => setOpen(o => !o)}
                className="fixed bottom-20 right-4 z-[59] w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/30 hover:bg-blue-600 active:scale-90 transition-colors lg:hidden"
            >
                <motion.span
                    className="material-symbols-outlined text-2xl"
                    animate={{ rotate: open ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    add
                </motion.span>
            </motion.button>
        </>
    );
}
