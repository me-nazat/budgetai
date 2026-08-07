'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';

interface CategoryData {
  category: string;
  total: number;
}

interface FinancialMandalaProps {
  data: CategoryData[];
  width?: number;
  height?: number;
  className?: string;
}

export default function FinancialMandala({ data, width = 400, height = 400, className = '' }: FinancialMandalaProps) {
  const { categories: customCats } = useCustomCategories('all');

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 20;

  // Memoize all complex geometry calculations
  const { paths, nodes, gradients } = useMemo(() => {
    if (!data || data.length === 0) {
      return { paths: [], nodes: [], gradients: [] };
    }

    // Sort by total to have consistent rendering order (biggest first or last)
    const sortedData = [...data].sort((a, b) => b.total - a.total);
    
    const totalSpending = sortedData.reduce((sum, item) => sum + item.total, 0);
    const numNodes = sortedData.length;
    const angleStep = (Math.PI * 2) / numNodes;

    const computedNodes: any[] = [];
    const computedGradients: any[] = [];
    
    // Base structural path connecting all nodes
    let structuralPath = '';

    sortedData.forEach((item, index) => {
      const angle = index * angleStep - Math.PI / 2; // start at top
      
      // Calculate radius based on spending proportion, minimum 20% of maxRadius so small ones still show
      const proportion = totalSpending > 0 ? item.total / totalSpending : 0;
      const nodeDistance = maxRadius * (0.4 + proportion * 0.6); 
      
      const x = cx + Math.cos(angle) * nodeDistance;
      const y = cy + Math.sin(angle) * nodeDistance;
      
      const hex = getCategoryHex(item.category, customCats);
      
      computedNodes.push({
        id: `node-${index}`,
        x,
        y,
        radius: 10 + proportion * 40, // Base radius + scale
        color: hex,
        angle,
      });

      computedGradients.push({
        id: `grad-${index}`,
        color: hex
      });

      // SVG path construction for the connecting web
      if (index === 0) {
        structuralPath += `M ${x} ${y} `;
      } else {
        // Curve to the next node using control points pulled towards center
        const cp1x = cx + Math.cos(angle - angleStep / 2) * (nodeDistance * 0.5);
        const cp1y = cy + Math.sin(angle - angleStep / 2) * (nodeDistance * 0.5);
        structuralPath += `Q ${cp1x} ${cp1y} ${x} ${y} `;
      }
    });

    // Close the path back to the first node
    if (computedNodes.length > 0) {
      const first = computedNodes[0];
      const last = computedNodes[computedNodes.length - 1];
      const endAngle = last.angle + angleStep / 2;
      const cp1x = cx + Math.cos(endAngle) * (maxRadius * 0.5);
      const cp1y = cy + Math.sin(endAngle) * (maxRadius * 0.5);
      structuralPath += `Q ${cp1x} ${cp1y} ${first.x} ${first.y} Z`;
    }

    return {
      paths: [structuralPath],
      nodes: computedNodes,
      gradients: computedGradients
    };
  }, [data, cx, cy, maxRadius, customCats]);

  if (paths.length === 0) {
    return <div className={`flex items-center justify-center opacity-50 ${className}`} style={{ width, height }}>No data to generate art</div>;
  }

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`} style={{ width, height }}>
      <motion.svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${width} ${height}`}
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        className="w-full h-full drop-shadow-2xl"
      >
        <defs>
          {gradients.map((grad, i) => (
            <radialGradient key={grad.id} id={grad.id} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={grad.color} stopOpacity={0.8} />
              <stop offset="100%" stopColor={grad.color} stopOpacity={0} />
            </radialGradient>
          ))}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer ambient glow circles */}
        {nodes.map((node, i) => (
          <motion.circle
            key={`ambient-${node.id}`}
            cx={node.x}
            cy={node.y}
            r={node.radius * 2.5}
            fill={`url(#${gradients[i].id})`}
            filter="url(#glow)"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 4 + (i % 3),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2
            }}
          />
        ))}

        {/* Structural Web */}
        <motion.path
          d={paths[0]}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />

        {/* Node Points */}
        {nodes.map((node, i) => (
          <motion.g key={`node-group-${node.id}`}>
            {/* Connection to center */}
            <line x1={cx} y1={cy} x2={node.x} y2={node.y} stroke={node.color} strokeOpacity={0.2} strokeWidth={1} />
            
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={node.radius}
              fill={node.color}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: i * 0.1, bounce: 0.5 }}
            />
            
            {/* Inner core */}
            <circle cx={node.x} cy={node.y} r={node.radius * 0.4} fill="#fff" opacity={0.4} />
          </motion.g>
        ))}

        {/* Center Core */}
        <motion.circle 
          cx={cx} 
          cy={cy} 
          r={15} 
          fill="rgba(255,255,255,0.1)" 
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={2}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.svg>
    </div>
  );
}
