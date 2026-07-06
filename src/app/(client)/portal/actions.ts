"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import { addComment } from "@/services/checklists.service";

export async function setLocaleAction(
  locale: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const l = z.enum(["en", "hi"]).parse(locale);
    const cookieStore = await cookies();
    cookieStore.set("NEXT_LOCALE", l, { maxAge: 365 * 24 * 60 * 60 });
    revalidatePath("/portal");
    return undefined;
  });
}

export async function addClientCommentAction(
  checklistId: string,
  itemId: string,
  body: string
): Promise<ActionResult<any>> {
  return runAction(async () => {
    const cid = z.string().uuid().parse(checklistId);
    const iid = z.string().uuid().parse(itemId);
    const comment = await addComment(iid, body);
    revalidatePath(`/portal/checklists/${cid}`);
    return comment;
  });
}
