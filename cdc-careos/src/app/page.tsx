import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/actor";

export default async function Home() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  redirect(actor.kind === "guardian" ? "/portal" : "/dashboard");
}
