"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import { resetPassword } from "@/services/users.service";

const schema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters long."),
});

export async function resetPasswordAction(input: {
  token: string;
  password: string;
}): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const data = schema.parse(input);
    await resetPassword(data.token, data.password);
    return undefined;
  });
}
