"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Download,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Home,
  FileText,
  MessageSquare,
  Heart,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/misc";
import { useT } from "@/i18n/client";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  children: Users,
  schedule: CalendarDays,
  sessions: ClipboardList,
  reports: BarChart3,
  assistant: Sparkles,
  staff: UserCog,
  services: Settings2,
  consents: ShieldCheck,
  audit: History,
  exports: Download,
  settings: Settings,
  home: Home,
  appointments: CalendarDays,
  portalReports: FileText,
  activities: Heart,
  messages: MessageSquare,
  profile: UserRound,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  primary?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

function isActive(pathname: string, href: string) {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-6">
      {groups.map((g, i) => (
        <div key={i}>
          {g.label && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-teal-50 text-teal-800" : "text-navy-600 hover:bg-navy-50 hover:text-ink",
                    )}
                  >
                    <Icon className={cn("size-[18px]", active ? "text-teal-600" : "text-navy-400")} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserCard({ name, subtitle }: { name: string; subtitle: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-canvas p-3">
      <Avatar name={name} className="size-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      <form action={logoutAction}>
        <button type="submit" className="rounded-lg p-2 text-navy-400 hover:bg-white hover:text-danger-600" aria-label={t("nav.logout")} title={t("nav.logout")}>
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function AppShell({
  groups,
  bottomNav,
  user,
  homeHref,
  children,
}: {
  groups: NavGroup[];
  bottomNav: NavItem[];
  user: { name: string; subtitle: string };
  homeHref: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <Link href={homeHref} className="px-2">
          <Logo />
        </Link>
        <div className="mt-8 flex-1 overflow-y-auto pr-1">
          <NavLinks groups={groups} />
        </div>
        <div className="space-y-3 pt-4">
          <LanguageSwitcher className="w-full justify-center" />
          <UserCard {...user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
          <Link href={homeHref}>
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="rounded-xl p-2 text-navy-600 hover:bg-navy-50" aria-label={t("nav.menu")}>
                <Menu className="size-5" />
              </DialogTrigger>
              <DialogContent title={t("nav.menu")}>
                <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
                <div className="mt-6">
                  <UserCard {...user} />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>

        {/* Mobile bottom navigation */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Primary">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${bottomNav.length}, minmax(0, 1fr))` }}>
            {bottomNav.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-teal-700" : "text-navy-400")}
                  >
                    <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-teal-50")}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="max-w-full truncate px-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
