'use client';

import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useState } from 'react';

type IconName = keyof typeof Icons;

interface AnimatedIconProps {
  name: IconName;
  size?: number;
  className?: string;
  animate?: boolean;
  strokeWidth?: number;
}

export function AnimatedIcon({
  name,
  size = 24,
  className = '',
  animate = true,
  strokeWidth = 2,
}: AnimatedIconProps) {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = Icons[name] as React.ComponentType<any>;

  if (!IconComponent) return null;

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      animate={animate && isHovered ? { scale: 1.15, rotate: 5 } : { scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={className}
    >
      <IconComponent size={size} strokeWidth={strokeWidth} />
    </motion.div>
  );
}
