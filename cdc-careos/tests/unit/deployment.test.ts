import { describe, expect, it } from "vitest";
import { appBaseUrl, integrationOwnerUrl, isDatabaseConfigured, isDemoMode } from "@/lib/runtime-env";
import { appRoleName, deriveAppPassword, ownerConnection, runtimeConnection, withLogin } from "@/db/connection";
import { isProtectedDemoAccount } from "@/lib/demo";

// Fictional connection strings (no real hosts or secrets).
const OWNER_DIRECT = "postgresql://neondb_owner:OwnerSecret123@ep-demo-123.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const OWNER_POOLED = "postgresql://neondb_owner:OwnerSecret123@ep-demo-123-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
const neonOnVercel = { VERCEL: "1", DATABASE_URL: OWNER_POOLED, DATABASE_URL_UNPOOLED: OWNER_DIRECT };

describe("database configuration", () => {
  it("uses explicit settings outside Vercel, unchanged", () => {
    const env = { DATABASE_URL: "postgres://careos_app:a@localhost:5432/x", DATABASE_OWNER_URL: "postgres://careos_owner:b@localhost:5432/x", DATABASE_SSL: "false" };
    expect(integrationOwnerUrl(env)).toBeUndefined();
    expect(runtimeConnection(env)).toEqual({ connectionString: env.DATABASE_URL, ssl: undefined });
    expect(ownerConnection(env)).toEqual({ connectionString: env.DATABASE_OWNER_URL, ssl: undefined });
    expect(runtimeConnection({ ...env, DATABASE_SSL: "true" })?.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("never runs the app as the integration's owner role", () => {
    const rt = runtimeConnection(neonOnVercel)!;
    const url = new URL(rt.connectionString);
    expect(url.username).toBe("careos_app");
    expect(url.password).not.toBe("OwnerSecret123");
    expect(url.password).toBe(deriveAppPassword(OWNER_DIRECT, "careos_app"));
    // direct (non-pooled) host, verified TLS, libpq TLS parameters removed
    expect(url.hostname).toBe("ep-demo-123.us-east-1.aws.neon.tech");
    expect(url.searchParams.has("sslmode")).toBe(false);
    expect(url.searchParams.has("channel_binding")).toBe(false);
    expect(rt.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("gives migrations the owner connection with verified TLS", () => {
    const owner = ownerConnection(neonOnVercel)!;
    expect(new URL(owner.connectionString).username).toBe("neondb_owner");
    expect(owner.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("derives a strong, stable runtime password tied to the owner password and role", () => {
    const a = deriveAppPassword(OWNER_DIRECT, "careos_app");
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveAppPassword(OWNER_DIRECT, "careos_app")).toBe(a);
    expect(deriveAppPassword(OWNER_DIRECT.replace("OwnerSecret123", "Other456"), "careos_app")).not.toBe(a);
    expect(deriveAppPassword(OWNER_DIRECT, "other_role")).not.toBe(a);
    expect(() => deriveAppPassword("postgresql://u@host/db", "careos_app")).toThrow();
  });

  it("prefers explicit configuration over an integration", () => {
    const env = { ...neonOnVercel, DATABASE_OWNER_URL: "postgres://careos_owner:b@db.example/x", DATABASE_URL: "postgres://careos_app:a@db.example/x" };
    expect(integrationOwnerUrl(env)).toBeUndefined();
    expect(runtimeConnection(env)?.connectionString).toBe(env.DATABASE_URL);
  });

  it("does not treat a plain DATABASE_URL on Vercel as an owner connection", () => {
    const env = { VERCEL: "1", DATABASE_URL: "postgres://careos_app:a@db.example/x" };
    expect(integrationOwnerUrl(env)).toBeUndefined();
    expect(runtimeConnection(env)?.connectionString).toBe(env.DATABASE_URL);
  });

  it("finds integration variables with a custom prefix and Supabase-style names", () => {
    expect(integrationOwnerUrl({ VERCEL: "1", STORAGE_DATABASE_URL_UNPOOLED: OWNER_DIRECT })).toBe(OWNER_DIRECT);
    const supa = "postgres://postgres.abcdefgh:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require";
    const rt = runtimeConnection({ VERCEL: "1", POSTGRES_URL_NON_POOLING: supa })!;
    expect(new URL(rt.connectionString).username).toBe("careos_app.abcdefgh");
  });

  it("reports when no database is connected yet", () => {
    expect(isDatabaseConfigured({ VERCEL: "1" })).toBe(false);
    expect(runtimeConnection({ VERCEL: "1" })).toBeNull();
    expect(isDatabaseConfigured(neonOnVercel)).toBe(true);
    expect(isDatabaseConfigured({ DATABASE_URL: "postgres://careos_app:a@localhost/x" })).toBe(true);
  });

  it("keeps passwords with special characters intact", () => {
    const url = withLogin("postgres://o:p@h:5432/d", "careos_app", "a%b@c:d/e");
    expect(decodeURIComponent(new URL(url).password)).toBe("a%b@c:d/e");
  });

  it("validates the runtime role name", () => {
    expect(appRoleName({})).toBe("careos_app");
    expect(appRoleName({ DATABASE_APP_ROLE: "careos_app_sim" })).toBe("careos_app_sim");
    expect(() => appRoleName({ DATABASE_APP_ROLE: "x; DROP ROLE y" })).toThrow();
  });
});

describe("demo mode and public URL", () => {
  it("is off unless explicitly switched on", () => {
    expect(isDemoMode({})).toBe(false);
    expect(isDemoMode({ CAREOS_DEMO_MODE: "false" })).toBe(false);
    expect(isDemoMode({ CAREOS_DEMO_MODE: " TRUE " })).toBe(true);
    expect(isDemoMode({ CAREOS_DEMO_MODE: "yes" })).toBe(true);
  });

  it("protects shared demo accounts only in demo mode", () => {
    expect(isProtectedDemoAccount("coordinator@demo.careos.local", { CAREOS_DEMO_MODE: "true" })).toBe(true);
    expect(isProtectedDemoAccount("coordinator@demo.careos.local", {})).toBe(false);
    expect(isProtectedDemoAccount("someone@center.in", { CAREOS_DEMO_MODE: "true" })).toBe(false);
  });

  it("builds the public base URL", () => {
    expect(appBaseUrl({ APP_URL: "https://care.example.in/" })).toBe("https://care.example.in");
    expect(appBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "cdc-careos.vercel.app" })).toBe("https://cdc-careos.vercel.app");
    expect(appBaseUrl({})).toBe("http://localhost:3000");
  });
});
