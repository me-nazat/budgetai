'use client';

import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
  blurDataURL?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill,
  priority = false,
  className = '',
  containerClassName = '',
  aspectRatio,
  blurDataURL,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      className={`relative overflow-hidden ${containerClassName}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Skeleton placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 skeleton bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        className="w-full h-full"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          fill={fill}
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
          quality={85}
          placeholder={blurDataURL ? 'blur' : 'empty'}
          blurDataURL={blurDataURL}
          onLoad={() => setIsLoaded(true)}
          className={`object-cover transition-transform duration-500 hover:scale-105 ${className}`}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </motion.div>
    </div>
  );
}
