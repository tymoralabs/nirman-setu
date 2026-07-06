"use client";

import { useTransition } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createProjectAction,
  updateProjectAction,
  type ProjectInput,
} from "./actions";

export const PROJECT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];

export interface ClientOption {
  id: string;
  name: string;
}

export interface ProjectFormValues {
  name: string;
  clientId: string;
  city: string;
  siteAddress: string;
  description: string;
  status: ProjectStatus;
}

export const EMPTY_PROJECT: ProjectFormValues = {
  name: "",
  clientId: "",
  city: "",
  siteAddress: "",
  description: "",
  status: "active",
};

export const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function ProjectDialog({
  open,
  onOpenChange,
  clientOptions,
  editingId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientOptions: ClientOption[];
  /** null = create */
  editingId: string | null;
  initial: ProjectFormValues;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<ProjectFormValues>(initial);
  const [pending, startTransition] = useTransition();

  // re-sync form whenever a different project is opened
  const [syncKey, setSyncKey] = useState<string | null>(editingId);
  if (open && syncKey !== editingId) {
    setSyncKey(editingId);
    setForm(initial);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: ProjectInput = {
      name: form.name,
      clientId: form.clientId,
      city: form.city || undefined,
      siteAddress: form.siteAddress || undefined,
      description: form.description || undefined,
      status: form.status,
    };
    startTransition(async () => {
      const res = editingId
        ? await updateProjectAction(editingId, payload)
        : await createProjectAction(payload);
      if (res.ok) {
        toast.success(editingId ? "Project updated." : "Project created.");
        onOpenChange(false);
        setForm(EMPTY_PROJECT);
        setSyncKey(null);
        onSaved?.();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {editingId
              ? "Update project details."
              : "Create a project and link it to a client."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-client">Client</Label>
            <select
              id="project-client"
              className={selectClass}
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              required
            >
              <option value="" disabled>
                Pick a client…
              </option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-city">City</Label>
              <Input
                id="project-city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <select
                id="project-status"
                className={selectClass}
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ProjectStatus })
                }
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-address">Site address</Label>
            <Input
              id="project-address"
              value={form.siteAddress}
              onChange={(e) =>
                setForm({ ...form, siteAddress: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
