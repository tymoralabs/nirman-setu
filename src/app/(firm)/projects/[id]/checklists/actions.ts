"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import {
  createChecklist,
  sendChecklist,
  updateChecklistItemStatus,
  toggleHardCopyReceived,
  addComment,
} from "@/services/checklists.service";

const createChecklistSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(200),
  notes: z.string().trim().max(1000).optional(),
  templateId: z.string().uuid().nullable().optional(),
  libraryItems: z
    .array(
      z.object({
        libraryItemId: z.string().uuid(),
        isMandatory: z.boolean(),
      })
    )
    .optional(),
});

export async function createChecklistAction(
  input: z.infer<typeof createChecklistSchema>
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = createChecklistSchema.parse(input);
    const result = await createChecklist(data);
    revalidatePath(`/projects/${data.projectId}`);
    return result;
  });
}

export async function sendChecklistAction(
  projectId: string,
  checklistId: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const cid = z.string().uuid().parse(checklistId);
    const pid = z.string().uuid().parse(projectId);
    await sendChecklist(cid);
    revalidatePath(`/projects/${pid}`);
    revalidatePath(`/projects/${pid}/checklists/${cid}`);
    return undefined;
  });
}

export async function updateChecklistItemStatusAction(
  projectId: string,
  checklistId: string,
  input: {
    itemId: string;
    status: "pending" | "received" | "rejected" | "waived";
    rejectionReason?: string | null;
    waivedReason?: string | null;
  }
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const pid = z.string().uuid().parse(projectId);
    const cid = z.string().uuid().parse(checklistId);
    await updateChecklistItemStatus(input);
    revalidatePath(`/projects/${pid}`);
    revalidatePath(`/projects/${pid}/checklists/${cid}`);
    return undefined;
  });
}

export async function toggleHardCopyReceivedAction(
  projectId: string,
  checklistId: string,
  itemId: string,
  hardCopyReceived: boolean
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const pid = z.string().uuid().parse(projectId);
    const cid = z.string().uuid().parse(checklistId);
    await toggleHardCopyReceived(z.string().uuid().parse(itemId), hardCopyReceived);
    revalidatePath(`/projects/${pid}`);
    revalidatePath(`/projects/${pid}/checklists/${cid}`);
    return undefined;
  });
}

export async function addCommentAction(
  projectId: string,
  checklistId: string,
  itemId: string,
  body: string
): Promise<ActionResult<any>> {
  return runAction(async () => {
    const pid = z.string().uuid().parse(projectId);
    const cid = z.string().uuid().parse(checklistId);
    const comment = await addComment(z.string().uuid().parse(itemId), body);
    revalidatePath(`/projects/${pid}/checklists/${cid}`);
    return comment;
  });
}
