"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import {
  createLibraryItem,
  setLibraryItemActive,
  updateLibraryItem,
} from "@/services/library.service";

const itemSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  titleHi: z.string().trim().max(200).optional(),
  category: z.string().trim().min(1, "Category is required.").max(100),
  helpText: z.string().trim().max(2000).optional(),
});

export type LibraryItemInput = z.infer<typeof itemSchema>;

export async function createLibraryItemAction(
  input: LibraryItemInput
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = itemSchema.parse(input);
    const result = await createLibraryItem({
      ...data,
      titleHi: data.titleHi || null,
      helpText: data.helpText || null,
    });
    revalidatePath("/library");
    return result;
  });
}

export async function updateLibraryItemAction(
  itemId: string,
  input: LibraryItemInput
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const data = itemSchema.parse(input);
    await updateLibraryItem(z.string().uuid().parse(itemId), {
      ...data,
      titleHi: data.titleHi || null,
      helpText: data.helpText || null,
    });
    revalidatePath("/library");
    return undefined;
  });
}

export async function setLibraryItemActiveAction(
  itemId: string,
  isActive: boolean
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await setLibraryItemActive(
      z.string().uuid().parse(itemId),
      z.boolean().parse(isActive)
    );
    revalidatePath("/library");
    return undefined;
  });
}
