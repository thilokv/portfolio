/**
 * Hosted-deployment safety checks against the real test database.
 */
import { afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { assertRestrictedRole } from "../../scripts/lib/migrations";

const client = new Client({ connectionString: process.env.DATABASE_OWNER_URL });
const connected = client.connect();

afterAll(async () => {
  await client.end();
});

describe("runtime role guard", () => {
  it("accepts the restricted application role", async () => {
    await connected;
    await expect(assertRestrictedRole(client, process.env.DATABASE_APP_ROLE ?? "careos_app")).resolves.toBeUndefined();
  });

  it("refuses the table owner, which would bypass Row Level Security", async () => {
    await connected;
    const owner = (await client.query<{ u: string }>("SELECT current_user AS u")).rows[0].u;
    await expect(assertRestrictedRole(client, owner)).rejects.toThrow(/refusing/);
  });

  it("refuses a role that does not exist", async () => {
    await connected;
    await expect(assertRestrictedRole(client, "careos_no_such_role")).rejects.toThrow(/does not exist/);
  });
});
