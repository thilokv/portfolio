import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-navy-50 text-navy-600 ring-1 ring-inset ring-navy-100",
      navy: "bg-navy-800 text-white",
      teal: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100",
      blue: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100",
      success: "bg-success-50 text-success-600 ring-1 ring-inset ring-success-600/15",
      warning: "bg-warning-50 text-warning-600 ring-1 ring-inset ring-warning-600/15",
      danger: "bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-600/15",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
