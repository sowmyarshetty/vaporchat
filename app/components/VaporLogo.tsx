"use client";

import Link from "next/link";

/**
 * Abstract vapor/steam logo — flowing curves, line-based, minimal.
 * Suggests steam, warmth, energy through clean, smooth forms.
 */
export function VaporLogo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/create"
      className={`inline-flex items-center gap-2 transition-opacity hover:opacity-80 ${className}`}
      aria-label="Sowmya Vapor Chat — Home"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-[var(--vapor-charcoal)]"
        aria-hidden
      >
        {/* Flowing vapor/steam curves — smooth, minimal strokes */}
        <path
          d="M8 20 Q12 14 16 18 T24 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 24 Q14 18 18 22 T26 18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <path
          d="M6 16 Q10 10 14 14 T22 10"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />
      </svg>
      <span className="sr-only">Sowmya Vapor Chat</span>
    </Link>
  );
}
