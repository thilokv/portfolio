import { execSync } from "node:child_process";

/** Fresh, fictional test data for every E2E run (test database only). */
export default function globalSetup() {
  const run = (f: string) => execSync(`node --env-file=.env.test --conditions=react-server --import tsx ${f}`, { stdio: "inherit" });
  run("scripts/reset.ts");
  run("scripts/migrate.ts");
  run("scripts/seed.ts");
}
