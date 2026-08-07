'use client';

import Link, { LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';

interface PrefetchLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>, LinkProps {
  children: ReactNode;
  className?: string;
}

export function PrefetchLink({ href, children, className, ...props }: PrefetchLinkProps) {
  const router = useRouter();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [hasPrefetched, setHasPrefetched] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasPrefetched) {
            router.prefetch(href.toString());
            setHasPrefetched(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (linkRef.current) observer.observe(linkRef.current);
    return () => observer.disconnect();
  }, [href, hasPrefetched, router]);

  return (
    <Link ref={linkRef} href={href} className={className} prefetch={false} {...props}>
      {children}
    </Link>
  );
}
