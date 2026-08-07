'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { usePathname } from 'next/navigation';

const variants: Variants = {
  initial: { opacity: 0, x: 20, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 30, mass: 0.9 } },
  exit: { opacity: 0, x: -20, scale: 0.98, transition: { type: 'spring', stiffness: 300, damping: 30, mass: 0.9 } },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pathname} variants={variants} initial="initial" animate="animate" exit="exit" className="w-full">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
