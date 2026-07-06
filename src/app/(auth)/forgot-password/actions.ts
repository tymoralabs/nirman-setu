"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import { forgotPassword } from "@/services/users.service";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

/** Always succeeds (no account enumeration) — staff accounts only. */
export async function forgotPasswordAction(input: {
  email: string;
}): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const data = schema.parse(input);
    await forgotPassword(data.email);
    return undefined;
  });
}
