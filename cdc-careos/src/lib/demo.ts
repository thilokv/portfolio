/**
 * The fictional demo center (scripts/lib/demo-seed.ts). These accounts exist
 * only in a database seeded with demo data; the password is public by design
 * and is shown on the sign-in page only in demo mode.
 */
import { isDemoMode } from "./runtime-env";

export const DEMO_PASSWORD = "CareOS-Demo-2026";

export const DEMO_EMAIL_DOMAIN = "demo.careos.local";

/** Accounts offered on the sign-in page in demo mode (label = message key). */
export const DEMO_SIGN_IN_ACCOUNTS = [
  { email: `coordinator@${DEMO_EMAIL_DOMAIN}`, labelKey: "enum.role.clinical_coordinator" },
  { email: `admin@${DEMO_EMAIL_DOMAIN}`, labelKey: "enum.role.admin" },
  { email: `speech@${DEMO_EMAIL_DOMAIN}`, labelKey: "enum.role.speech_therapist" },
  { email: `parent@${DEMO_EMAIL_DOMAIN}`, labelKey: "auth.demoParent" },
] as const;

/**
 * In demo mode the shared demo accounts must keep working for every visitor,
 * so their e-mail, password and active status cannot be changed.
 */
export function isProtectedDemoAccount(email: string, env: Record<string, string | undefined> = process.env): boolean {
  return isDemoMode(env) && email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
