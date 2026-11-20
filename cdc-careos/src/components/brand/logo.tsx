import { cn } from "@/lib/utils";

/** CareOS mark: two overlapping rounded shapes (care + growth). */
export function Logo({ className, withText = true, inverted = false }: { className?: string; withText?: boolean; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill={inverted ? "#ffffff" : "#182b3f"} />
        <circle cx="12.5" cy="17" r="6.5" fill="#4cb2a4" />
        <circle cx="19.5" cy="13" r="5" fill={inverted ? "#182b3f" : "#ffffff"} fillOpacity="0.92" />
      </svg>
      {withText && (
        <span className={cn("text-[17px] font-bold tracking-tight", inverted ? "text-white" : "text-ink")}>
          CDC <span className={inverted ? "text-teal-300" : "text-teal-600"}>CareOS</span>
        </span>
      )}
    </span>
  );
}
