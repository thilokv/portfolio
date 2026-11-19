import { NextResponse } from "next/server";
import { withOrg } from "@/db";
import { getActor, staffCtx } from "@/server/auth/actor";
import { DATASETS, exportDataset, type Dataset } from "@/server/services/export";
import { isoDateIST } from "@/lib/dates";

export async function GET(_req: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  const actor = await getActor();
  if (!actor || actor.kind !== "staff" || !actor.permissions.includes("data.export")) return new NextResponse("Forbidden", { status: 403 });
  if (!(DATASETS as readonly string[]).includes(dataset)) return new NextResponse("Not found", { status: 404 });
  const csv = await withOrg(staffCtx(actor), (tx) => exportDataset(tx, actor, dataset as Dataset));
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="careos-${dataset}-${isoDateIST()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
