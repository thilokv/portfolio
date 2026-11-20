import { FlaskConical } from "lucide-react";

/** Shown on every signed-in page of a public demo deployment (CAREOS_DEMO_MODE). */
export function DemoNotice({ text }: { text: string }) {
  return (
    <div role="note" className="no-print border-b border-warning-600/20 bg-warning-50 px-4 py-2 text-center text-xs font-medium text-warning-600 sm:text-sm">
      <FlaskConical className="mr-1.5 inline size-4 align-[-3px]" aria-hidden />
      {text}
    </div>
  );
}
