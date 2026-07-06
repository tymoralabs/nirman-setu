"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import {
  createAssociateInvite,
  disableAssociate,
} from "@/services/users.service";

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
});

export async function inviteAssociateAction(input: {
  name: string;
  email: string;
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = inviteSchema.parse(input);
    const result = await createAssociateInvite(data);
    revalidatePath("/staff");
    return result;
  });
}

export async function disableAssociateAction(
  userId: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await disableAssociate(z.string().uuid().parse(userId));
    revalidatePath("/staff");
    return undefined;
  });
}
