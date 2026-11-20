import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-sky-100 bg-sky-50 text-sky-700", Icon: Info },
  success: { cls: "border-success-600/15 bg-success-50 text-success-600", Icon: CheckCircle2 },
  warning: { cls: "border-warning-600/15 bg-warning-50 text-warning-600", Icon: AlertTriangle },
  danger: { cls: "border-danger-600/15 bg-danger-50 text-danger-600", Icon: ShieldAlert },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed opacity-95">{children}</div>}
      </div>
    </div>
  );
}
