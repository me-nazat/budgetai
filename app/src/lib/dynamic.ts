import dynamic from 'next/dynamic';

// Heavy chart components
export const DynamicAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  { ssr: false }
);

export const DynamicPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { ssr: false }
);

// Animation libraries (only load on client)
export const DynamicMotionDiv = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.div),
  { ssr: false }
);

// Feature-specific heavy components
export const DynamicSpendingChart = dynamic(
  () => import('@/components/charts/SpendingChart').then((mod) => mod.default),
  { 
    ssr: false,
  }
);

export const DynamicCommandPalette = dynamic(
  () => import('@/components/layout/CommandPalette').then((mod) => mod.CommandPalette),
  { ssr: false }
);
