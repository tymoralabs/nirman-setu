"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-utils";
import {
  allocateAssociate,
  createProject,
  deallocateAssociate,
  updateProject,
} from "@/services/projects.service";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(200),
  clientId: z.string().uuid("Pick a client."),
  city: z.string().trim().max(120).optional(),
  siteAddress: z.string().trim().max(500).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["active", "on_hold", "completed", "archived"]),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export async function createProjectAction(
  input: ProjectInput
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = projectSchema.parse(input);
    const result = await createProject({
      ...data,
      city: data.city || null,
      siteAddress: data.siteAddress || null,
      description: data.description || null,
    });
    revalidatePath("/projects");
    return result;
  });
}

export async function updateProjectAction(
  projectId: string,
  input: ProjectInput
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const data = projectSchema.parse(input);
    const id = z.string().uuid().parse(projectId);
    await updateProject(id, {
      ...data,
      city: data.city || null,
      siteAddress: data.siteAddress || null,
      description: data.description || null,
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return undefined;
  });
}

export async function allocateAssociateAction(
  projectId: string,
  userId: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const pid = z.string().uuid().parse(projectId);
    await allocateAssociate(pid, z.string().uuid().parse(userId));
    revalidatePath("/projects");
    revalidatePath(`/projects/${pid}`);
    return undefined;
  });
}

export async function deallocateAssociateAction(
  projectId: string,
  userId: string
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const pid = z.string().uuid().parse(projectId);
    await deallocateAssociate(pid, z.string().uuid().parse(userId));
    revalidatePath("/projects");
    revalidatePath(`/projects/${pid}`);
    return undefined;
  });
}
