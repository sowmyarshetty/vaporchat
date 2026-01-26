"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VaporLogo } from "./VaporLogo";

export function Header() {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `text-sm font-medium tracking-wide transition-colors hover:text-[var(--vapor-amber)] ${
      pathname === path
        ? "text-[var(--vapor-charcoal)] underline underline-offset-4"
        : "text-[var(--vapor-warm-gray)]"
    }`;

  return (
    <header className="border-b border-[var(--vapor-stone)] bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <VaporLogo />
        <nav className="flex items-center gap-8" role="navigation">
          <Link href="/create" className={linkClass("/create")}>
            Create a Room
          </Link>
          <Link href="/join" className={linkClass("/join")}>
            Join a Room
          </Link>
        </nav>
      </div>
    </header>
  );
}
