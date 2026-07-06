"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";

export async function impersonateFirmAction(
  firmId: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await requireRole("platform_owner");
    const fid = z.string().uuid().parse(firmId);

    const cookieStore = await cookies();
    cookieStore.set("impersonate_firm_id", fid, { maxAge: 2 * 60 * 60 }); // 2 hours
    return undefined;
  });
}

export async function stopImpersonatingAction(): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const cookieStore = await cookies();
    cookieStore.delete("impersonate_firm_id");
    return undefined;
  });
}
