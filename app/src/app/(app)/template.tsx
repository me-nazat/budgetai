'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
                type: 'spring',
                stiffness: 300,
                damping: 24,
                mass: 0.8
            }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
}
