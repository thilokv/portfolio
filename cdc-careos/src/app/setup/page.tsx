import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { isDatabaseConfigured } from "@/lib/runtime-env";

export const metadata: Metadata = { title: "Finish setup" };

/**
 * Shown by a fresh hosted deployment until a database is connected
 * (see src/proxy.ts). Written for the person deploying, in English.
 */
export default function SetupPage() {
  if (isDatabaseConfigured()) redirect("/login");
  const steps = [
    "In Vercel, open this project and go to the Storage tab.",
    "Create a database and choose Neon (Serverless Postgres). The free plan is enough. Keep the suggested settings.",
    "Connect the database to this project (keep all environments ticked).",
    "Open the Deployments tab, open the ⋯ menu of the newest deployment and choose Redeploy.",
  ];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <Logo />
      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <Database className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Almost there: connect a database</h1>
        <p className="mt-2 text-sm text-muted">
          CareOS is online, but it has nowhere to keep its records yet. These four steps take about two minutes.
        </p>
        <ol className="mt-5 space-y-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-muted">
          The new deployment creates the tables and security rules. When this site was created with demo mode switched on, it also loads the fictional demo center. This page then turns into the sign-in page.
        </p>
      </div>
    </main>
  );
}
