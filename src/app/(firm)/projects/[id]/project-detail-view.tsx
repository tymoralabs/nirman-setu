"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateIst } from "@/lib/dates";
import {
  allocateAssociateAction,
  deallocateAssociateAction,
} from "../actions";
import {
  ProjectDialog,
  selectClass,
  type ClientOption,
  type ProjectStatus,
} from "../project-dialog";

interface ProjectDetail {
  id: string;
  name: string;
  city: string | null;
  siteAddress: string | null;
  description: string | null;
  status: ProjectStatus;
  clientId: string;
  createdAt: string;
}

interface ClientInfo {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  whatsappOptIn: boolean;
}

interface Assignment {
  userId: string;
  name: string;
  email: string | null;
  status: "invited" | "active" | "disabled";
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

import { Plus, FileText, ClipboardList, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createChecklistAction, sendChecklistAction } from "./checklists/actions";

interface ChecklistItemOption {
  id: string;
  title: string;
  category: string;
}

interface ChecklistSummary {
  id: string;
  title: string;
  status: "draft" | "sent" | "in_progress" | "completed";
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
}

export function ProjectDetailView({
  project,
  client,
  assignments,
  associateOptions,
  clientOptions,
  isAdmin,
  checklists = [],
  templateOptions = [],
  libraryOptions = [],
}: {
  project: ProjectDetail;
  client: ClientInfo;
  assignments: Assignment[];
  associateOptions: { id: string; name: string }[];
  clientOptions: ClientOption[];
  isAdmin: boolean;
  checklists?: ChecklistSummary[];
  templateOptions?: { id: string; name: string }[];
  libraryOptions?: ChecklistItemOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [selectedAssociate, setSelectedAssociate] = useState("");
  const [pending, startTransition] = useTransition();

  // Checklist form states
  const [cTitle, setCTitle] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [cMethod, setCMethod] = useState<"template" | "custom">("template");
  const [cTemplateId, setCTemplateId] = useState("");
  const [selectedLibItems, setSelectedLibItems] = useState<Record<string, { selected: boolean; isMandatory: boolean }>>({});

  const unassigned = associateOptions.filter(
    (a) => !assignments.some((s) => s.userId === a.id)
  );

  function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAssociate) return;
    startTransition(async () => {
      const res = await allocateAssociateAction(project.id, selectedAssociate);
      if (res.ok) {
        toast.success("Associate allocated.");
        setSelectedAssociate("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDeallocate(a: Assignment) {
    startTransition(async () => {
      const res = await deallocateAssociateAction(project.id, a.userId);
      if (res.ok) toast.success(`${a.name} removed from this project.`);
      else toast.error(res.error);
    });
  }

  function handleCreateChecklist(e: React.FormEvent) {
    e.preventDefault();
    if (!cTitle.trim()) return;

    const payload: any = {
      projectId: project.id,
      title: cTitle,
      notes: cNotes,
    };

    if (cMethod === "template") {
      if (!cTemplateId) {
        toast.error("Pick a template.");
        return;
      }
      payload.templateId = cTemplateId;
    } else {
      const items = Object.entries(selectedLibItems)
        .filter(([_, val]) => val.selected)
        .map(([id, val]) => ({
          libraryItemId: id,
          isMandatory: val.isMandatory,
        }));

      if (items.length === 0) {
        toast.error("Pick at least one document from library.");
        return;
      }
      payload.libraryItems = items;
    }

    startTransition(async () => {
      const res = await createChecklistAction(payload);
      if (res.ok) {
        toast.success("Checklist created.");
        setChecklistOpen(false);
        setCTitle("");
        setCNotes("");
        setCTemplateId("");
        setSelectedLibItems({});
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleSendChecklist(checklistId: string) {
    startTransition(async () => {
      const res = await sendChecklistAction(project.id, checklistId);
      if (res.ok) {
        toast.success("Checklist sent to client.");
      } else {
        toast.error(res.error);
      }
    });
  }

  // Group library options by category
  const libraryByCategory = libraryOptions.reduce((acc, item) => {
    acc[item.category] ??= [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItemOption[]>);

  const CHECKLIST_STATUS_STYLE: Record<ChecklistSummary["status"], string> = {
    draft: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
    sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  };

  const CHECKLIST_STATUS_LABEL: Record<ChecklistSummary["status"], string> = {
    draft: "Draft",
    sent: "Sent",
    in_progress: "In progress",
    completed: "Completed",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All projects
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge variant={project.status === "active" ? "default" : "secondary"}>
              {STATUS_LABEL[project.status]}
            </Badge>
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="City" value={project.city} />
            <DetailRow label="Site address" value={project.siteAddress} />
            <DetailRow label="Description" value={project.description} />
            <DetailRow label="Created" value={formatDateIst(project.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Name" value={client.name} />
            <DetailRow label="Phone" value={client.phone} />
            <DetailRow label="Email" value={client.email} />
            <DetailRow
              label="WhatsApp"
              value={client.whatsappOptIn ? "Opted in" : "Opted out"}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Allocated associates</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Associates allocated here can manage this project's checklists."
              : "Associates working on this project."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No associates allocated yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((a) => (
                <li
                  key={a.userId}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{a.name}</span>
                    {a.email && (
                      <span className="ml-2 text-muted-foreground">
                        {a.email}
                      </span>
                    )}
                    {a.status === "disabled" && (
                      <Badge variant="outline" className="ml-2">
                        Disabled
                      </Badge>
                    )}
                  </span>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${a.name}`}
                      disabled={pending}
                      onClick={() => handleDeallocate(a)}
                    >
                      <X />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isAdmin && unassigned.length > 0 && (
            <form onSubmit={handleAllocate} className="flex items-center gap-2">
              <select
                className={`${selectClass} max-w-xs`}
                value={selectedAssociate}
                onChange={(e) => setSelectedAssociate(e.target.value)}
                required
              >
                <option value="" disabled>
                  Pick an associate…
                </option>
                {unassigned.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={pending || !selectedAssociate}>
                Allocate
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Checklists</CardTitle>
            <CardDescription>
              Collect statutory documents from the client via templates or custom checklists.
            </CardDescription>
          </div>
          <Button onClick={() => setChecklistOpen(true)}>
            <Plus className="size-4" />
            Create Checklist
          </Button>
        </CardHeader>
        <CardContent>
          {checklists.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-sm">
              <ClipboardList className="mx-auto mb-4 size-10 text-muted-foreground/60" />
              <p className="font-medium">No checklists created yet</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Create a checklist to request documents from the client.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {checklists.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-4 text-sm hover:bg-muted/10 transition-colors"
                >
                  <div className="space-y-1">
                    <Link
                      href={`/projects/${project.id}/checklists/${c.id}`}
                      className="font-medium text-primary hover:underline block"
                    >
                      {c.title}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Created {formatDateIst(c.createdAt)}</span>
                      {c.sentAt && (
                        <>
                          <span>•</span>
                          <span>Sent {formatDateIst(c.sentAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${CHECKLIST_STATUS_STYLE[c.status]}`}
                    >
                      {CHECKLIST_STATUS_LABEL[c.status]}
                    </span>

                    {c.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        onClick={() => handleSendChecklist(c.id)}
                        title="Send checklist to client"
                      >
                        <Send className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Checklist Dialog */}
      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Document Checklist</DialogTitle>
            <DialogDescription>
              Compose a checklist. Clients can log in using OTP to upload papers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateChecklist} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Checklist Title</Label>
              <Input
                id="title"
                value={cTitle}
                onChange={(e) => setCTitle(e.target.value)}
                placeholder="e.g. Initial Land Documents, Pre-Sanction Clearance"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes / Instructions (Optional)</Label>
              <Input
                id="notes"
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                placeholder="Internal or client-facing instructions"
              />
            </div>

            <div className="space-y-2">
              <Label>Method</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="method"
                    checked={cMethod === "template"}
                    onChange={() => setCMethod("template")}
                  />
                  Use Template
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="method"
                    checked={cMethod === "custom"}
                    onChange={() => setCMethod("custom")}
                  />
                  Custom Selection
                </label>
              </div>
            </div>

            {cMethod === "template" ? (
              <div className="space-y-1.5">
                <Label htmlFor="template">Select Template</Label>
                <select
                  id="template"
                  className={selectClass}
                  value={cTemplateId}
                  onChange={(e) => setCTemplateId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Choose template…
                  </option>
                  {templateOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/10 max-h-72 overflow-y-auto">
                <h3 className="text-sm font-semibold mb-2">Select Documents from Library</h3>
                {Object.entries(libraryByCategory).map(([cat, items]) => (
                  <div key={cat} className="space-y-2 mb-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      {cat}
                    </h4>
                    <div className="space-y-2 pl-1">
                      {items.map((item) => {
                        const state = selectedLibItems[item.id] || { selected: false, isMandatory: true };
                        return (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer font-medium select-none">
                              <Checkbox
                                checked={state.selected}
                                onCheckedChange={(checked) => {
                                  setSelectedLibItems((prev) => ({
                                    ...prev,
                                    [item.id]: { ...state, selected: !!checked },
                                  }));
                                }}
                              />
                              {item.title}
                            </label>

                            {state.selected && (
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                                <Checkbox
                                  checked={state.isMandatory}
                                  onCheckedChange={(checked) => {
                                    setSelectedLibItems((prev) => ({
                                      ...prev,
                                      [item.id]: { ...state, isMandatory: !!checked },
                                    }));
                                  }}
                                />
                                Mandatory
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChecklistOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <ProjectDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          clientOptions={clientOptions}
          editingId={project.id}
          initial={{
            name: project.name,
            clientId: project.clientId,
            city: project.city ?? "",
            siteAddress: project.siteAddress ?? "",
            description: project.description ?? "",
            status: project.status,
          }}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value || "—"}</span>
    </div>
  );
}

