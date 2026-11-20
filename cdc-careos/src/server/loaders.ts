/** Request-scoped cached loaders shared by layouts and pages. */
import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { withOrg } from "@/db";
import { requireStaffPage, staffCtx } from "./auth/actor";
import { getChild } from "./services/children";
import { NotFoundError } from "./errors";

export const loadChild = cache(async (id: string) => {
  const actor = await requireStaffPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    const res = await withOrg(staffCtx(actor), (tx) => getChild(tx, actor, id));
    return { actor, ...res };
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
});
