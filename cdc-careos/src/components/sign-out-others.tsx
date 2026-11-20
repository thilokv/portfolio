"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { MonitorX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { signOutOtherSessionsAction } from "@/server/actions/auth";

export function SignOutOthers() {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" loading={pending} onClick={() => start(async () => {
      const res = await signOutOtherSessionsAction();
      if (res.ok) toast.success(t("settings.signedOutOthers"));
      else toast.error(t(res.error));
    })}>
      <MonitorX /> {t("settings.signOutEverywhere")}
    </Button>
  );
}
