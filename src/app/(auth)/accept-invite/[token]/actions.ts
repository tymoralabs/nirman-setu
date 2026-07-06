"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import { acceptInvite } from "@/services/users.service";

const schema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters long."),
});

export async function acceptInviteAction(input: {
  token: string;
  password: string;
}): Promise<ActionResult<{ email: string | null }>> {
  return runAction(async () => {
    const data = schema.parse(input);
    return acceptInvite(data.token, data.password);
  });
}
