"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProfileTabs({ base, tabs }: { base: string; tabs: { slug: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="no-print -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Child record sections">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const active = tab.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={tab.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "text-teal-700" : "text-navy-500 hover:text-ink",
                )}
              >
                {tab.label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-teal-600" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
