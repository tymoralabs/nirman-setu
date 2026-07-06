"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import { restoreDocument, softDeleteDocument } from "@/services/trash.service";

export async function restoreDocumentAction(
  documentId: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const id = z.string().uuid().parse(documentId);
    await restoreDocument(id);
    revalidatePath("/trash");
    return undefined;
  });
}

export async function softDeleteDocumentAction(
  projectId: string,
  checklistId: string,
  documentId: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const pid = z.string().uuid().parse(projectId);
    const cid = z.string().uuid().parse(checklistId);
    const docId = z.string().uuid().parse(documentId);
    await softDeleteDocument(docId);
    revalidatePath(`/projects/${pid}`);
    revalidatePath(`/projects/${pid}/checklists/${cid}`);
    revalidatePath("/trash");
    return undefined;
  });
}
