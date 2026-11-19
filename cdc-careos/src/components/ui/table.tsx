import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("whitespace-nowrap border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted", className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-line/70 px-4 py-3 align-top", className)} {...props} />;
}
