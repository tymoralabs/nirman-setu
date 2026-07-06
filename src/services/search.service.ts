import { and, eq, ilike, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireStaff } from "@/lib/authz";

export async function globalSearch(query: string) {
  const staff = await requireStaff();
  const db = await getDb();
  const term = `%${query.trim()}%`;

  if (!query.trim()) {
    return { projects: [], clients: [], documents: [] };
  }

  // Search projects
  const projects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      status: schema.projects.status,
    })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.firmId, staff.firmId),
        ilike(schema.projects.name, term)
      )
    )
    .limit(10);

  // Search clients
  const clients = await db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      email: schema.clients.email,
    })
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.firmId, staff.firmId),
        or(
          ilike(schema.clients.name, term),
          ilike(schema.clients.email, term),
          ilike(schema.clients.phone, term)
        )
      )
    )
    .limit(10);

  // Search documents (join to check project access & firmId)
  const documents = await db
    .select({
      id: schema.documents.id,
      fileName: schema.documents.fileName,
      checklistId: schema.checklists.id,
      projectId: schema.checklists.projectId,
    })
    .from(schema.documents)
    .innerJoin(
      schema.checklistItems,
      eq(schema.documents.checklistItemId, schema.checklistItems.id)
    )
    .innerJoin(
      schema.checklists,
      eq(schema.checklistItems.checklistId, schema.checklists.id)
    )
    .where(
      and(
        eq(schema.checklists.firmId, staff.firmId),
        ilike(schema.documents.fileName, term)
      )
    )
    .limit(10);

  return { projects, clients, documents };
}
