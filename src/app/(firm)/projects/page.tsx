import { forPage } from "@/lib/action-utils";
import { requireStaff } from "@/lib/authz";
import { listProjects } from "@/services/projects.service";
import { listClientOptions } from "@/services/clients.service";
import { ProjectsView } from "./projects-view";

export default async function ProjectsPage() {
  const user = await forPage(requireStaff());
  const [projects, clientOptions] = await Promise.all([
    forPage(listProjects()),
    forPage(listClientOptions()),
  ]);

  return (
    <div className="p-8">
      <ProjectsView
        isAdmin={user.role === "firm_admin"}
        clientOptions={clientOptions}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          city: p.city,
          status: p.status,
          clientName: p.clientName,
          associates: p.associates,
        }))}
      />
    </div>
  );
}
