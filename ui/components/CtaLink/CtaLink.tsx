'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { trackEvent } from '@/lib/ui/analytics';

interface CtaLinkProps {
  href: Route;
  label: string;
  className?: string;
  eventName: string;
}

export function CtaLink({ href, label, className, eventName }: CtaLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent(eventName, { href, label })}
    >
      {label}
    </Link>
  );
}
