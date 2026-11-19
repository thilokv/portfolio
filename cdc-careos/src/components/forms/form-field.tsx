"use client";
import * as React from "react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/input";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-danger-600" aria-hidden>*</span> : null}
      </Label>
      {children}
      {hint && !error && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-danger-600" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
