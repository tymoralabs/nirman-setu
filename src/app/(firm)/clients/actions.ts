"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import {
  addCoOwnerLogin,
  createClient,
  createClientLogin,
  updateClient,
} from "@/services/clients.service";

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+91[6-9]\d{9}$/,
    "Phone must be an Indian mobile in +91 format, e.g. +919876543210."
  );

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  whatsappOptIn: z.boolean(),
  notes: z.string().trim().max(2000).optional(),
});

export type ClientInput = z.infer<typeof clientSchema>;

export async function createClientAction(
  input: ClientInput
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = clientSchema.parse(input);
    const result = await createClient({
      ...data,
      email: data.email || null,
      notes: data.notes || null,
    });
    revalidatePath("/clients");
    return result;
  });
}

export async function updateClientAction(
  clientId: string,
  input: ClientInput
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const data = clientSchema.parse(input);
    await updateClient(z.string().uuid().parse(clientId), {
      ...data,
      email: data.email || null,
      notes: data.notes || null,
    });
    revalidatePath("/clients");
    return undefined;
  });
}

export async function createClientLoginAction(
  clientId: string
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const result = await createClientLogin(z.string().uuid().parse(clientId));
    revalidatePath("/clients");
    return result;
  });
}

const coOwnerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  phone: phoneSchema,
});

export async function addCoOwnerLoginAction(
  clientId: string,
  input: { name: string; phone: string }
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = coOwnerSchema.parse(input);
    const result = await addCoOwnerLogin(
      z.string().uuid().parse(clientId),
      data
    );
    revalidatePath("/clients");
    return result;
  });
}

export async function eraseClientAction(
  clientId: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { eraseClientData } = await import("@/services/dpdp.service");
    await eraseClientData(z.string().uuid().parse(clientId));
    revalidatePath("/clients");
    return undefined;
  });
}
