import { forPage } from "@/lib/action-utils";
import { getProjectDetail } from "@/services/projects.service";
import { listActiveAssociates } from "@/services/users.service";
import { listClientOptions } from "@/services/clients.service";
import { listChecklistsForProject } from "@/services/checklists.service";
import { listTemplates } from "@/services/templates.service";
import { listLibraryItems } from "@/services/library.service";
import { ProjectDetailView } from "./project-detail-view";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, client, assignments, viewerRole } = await forPage(
    getProjectDetail(id)
  );

  const isAdmin = viewerRole === "firm_admin";
  const [associates, clientOptions, checklists, templates, libraryItems] = await Promise.all([
    isAdmin ? forPage(listActiveAssociates()) : Promise.resolve([]),
    isAdmin ? forPage(listClientOptions()) : Promise.resolve([]),
    forPage(listChecklistsForProject(id)),
    forPage(listTemplates()),
    forPage(listLibraryItems()),
  ]);

  return (
    <div className="p-8">
      <ProjectDetailView
        isAdmin={isAdmin}
        project={{
          id: project.id,
          name: project.name,
          city: project.city,
          siteAddress: project.siteAddress,
          description: project.description,
          status: project.status,
          clientId: project.clientId,
          createdAt: project.createdAt.toISOString(),
        }}
        client={client}
        assignments={assignments}
        associateOptions={associates}
        clientOptions={clientOptions}
        checklists={checklists.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          sentAt: c.sentAt?.toISOString() ?? null,
          completedAt: c.completedAt?.toISOString() ?? null,
        }))}
        templateOptions={templates.map((t) => ({
          id: t.id,
          name: t.name,
        }))}
        libraryOptions={libraryItems.filter((l) => l.isActive).map((l) => ({
          id: l.id,
          title: l.title,
          category: l.category,
        }))}
      />
    </div>
  );
}

