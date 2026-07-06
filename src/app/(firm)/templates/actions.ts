"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import {
  createTemplate,
  setTemplateActive,
  updateTemplate,
} from "@/services/templates.service";

const templateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required.").max(200),
  description: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        libraryItemId: z.string().uuid(),
        isMandatory: z.boolean(),
      })
    )
    .min(1, "Pick at least one library item."),
});

export type TemplateInput = z.infer<typeof templateSchema>;

export async function createTemplateAction(
  input: TemplateInput
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = templateSchema.parse(input);
    const result = await createTemplate({
      ...data,
      description: data.description || null,
    });
    revalidatePath("/templates");
    return result;
  });
}

export async function updateTemplateAction(
  templateId: string,
  input: TemplateInput
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const data = templateSchema.parse(input);
    await updateTemplate(z.string().uuid().parse(templateId), {
      ...data,
      description: data.description || null,
    });
    revalidatePath("/templates");
    return undefined;
  });
}

export async function setTemplateActiveAction(
  templateId: string,
  isActive: boolean
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await setTemplateActive(
      z.string().uuid().parse(templateId),
      z.boolean().parse(isActive)
    );
    revalidatePath("/templates");
    return undefined;
  });
}
