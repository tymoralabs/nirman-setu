"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EMPTY_PROJECT,
  ProjectDialog,
  type ClientOption,
  type ProjectStatus,
} from "./project-dialog";

interface ProjectRow {
  id: string;
  name: string;
  city: string | null;
  status: ProjectStatus;
  clientName: string;
  associates: { id: string; name: string }[];
}

const STATUS_BADGE: Record<
  ProjectStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Active", variant: "default" },
  on_hold: { label: "On hold", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
};

export function ProjectsView({
  projects,
  clientOptions,
  isAdmin,
}: {
  projects: ProjectRow[];
  clientOptions: ClientOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "All projects in your firm"
              : "Projects allocated to you"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <FolderPlus data-icon="inline-start" />
            New project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isAdmin
            ? "No projects yet. Create your first project to get started."
            : "No projects allocated to you yet. Ask your firm admin."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Associates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${p.id}`)}
              >
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.clientName}</TableCell>
                <TableCell>{p.city ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[p.status].variant}>
                    {STATUS_BADGE[p.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.associates.length > 0
                    ? p.associates.map((a) => a.name).join(", ")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isAdmin && (
        <ProjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          clientOptions={clientOptions}
          editingId={null}
          initial={EMPTY_PROJECT}
        />
      )}
    </div>
  );
}
