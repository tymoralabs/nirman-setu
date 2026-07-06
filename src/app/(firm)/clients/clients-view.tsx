"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addCoOwnerLoginAction,
  createClientAction,
  createClientLoginAction,
  updateClientAction,
  eraseClientAction,
} from "./actions";

interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  whatsappOptIn: boolean;
  notes: string | null;
  loginCount: number;
}

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  whatsappOptIn: boolean;
  notes: string;
}

const EMPTY_FORM: ClientForm = {
  name: "",
  phone: "+91",
  email: "",
  whatsappOptIn: true,
  notes: "",
};

export function ClientsView({ clients }: { clients: ClientRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [coOwnerFor, setCoOwnerFor] = useState<ClientRow | null>(null);
  const [coOwner, setCoOwner] = useState({ name: "", phone: "+91" });
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(c: ClientRow) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email ?? "",
      whatsappOptIn: c.whatsappOptIn,
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = editing
        ? await updateClientAction(editing.id, form)
        : await createClientAction(form);
      if (res.ok) {
        toast.success(editing ? "Client updated." : "Client added.");
        setDialogOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleCreateLogin(c: ClientRow) {
    startTransition(async () => {
      const res = await createClientLoginAction(c.id);
      if (res.ok) {
        toast.success(
          `Portal login created for ${c.name}. A welcome message was sent.`
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleErase(c: ClientRow) {
    if (
      !confirm(
        `DPDP COMPLIANCE WARNING: This action will permanently erase all records for client "${c.name}", including their active projects, checklists, and document uploads from storage. This action CANNOT be undone.\n\nAre you sure you want to proceed?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await eraseClientAction(c.id);
      if (res.ok) {
        toast.success("Client data erased successfully.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleAddCoOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!coOwnerFor) return;
    startTransition(async () => {
      const res = await addCoOwnerLoginAction(coOwnerFor.id, coOwner);
      if (res.ok) {
        toast.success(`Co-owner login created for ${coOwner.name}.`);
        setCoOwnerFor(null);
        setCoOwner({ name: "", phone: "+91" });
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            People and companies your firm serves
          </p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus data-icon="inline-start" />
          Add client
        </Button>
      </div>

      {clients.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No clients yet. Add your first client to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Portal login</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.whatsappOptIn ? "secondary" : "outline"}>
                    {c.whatsappOptIn ? "Opted in" : "Opted out"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {c.loginCount > 0 ? (
                    <Badge>
                      {c.loginCount === 1
                        ? "Has login"
                        : `${c.loginCount} logins`}
                    </Badge>
                  ) : (
                    <Badge variant="outline">No login</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" aria-label="Actions">
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        Edit
                      </DropdownMenuItem>
                      {c.loginCount === 0 && (
                        <DropdownMenuItem
                          disabled={pending}
                          onClick={() => handleCreateLogin(c)}
                        >
                          Create login
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={pending}
                        onClick={() => {
                          setCoOwner({ name: "", phone: "+91" });
                          setCoOwnerFor(c);
                        }}
                      >
                        Add co-owner login
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.open(`/api/clients/${c.id}/export`, "_blank")}
                        className="cursor-pointer"
                      >
                        Export Profile (DPDP)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={pending}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                        onClick={() => handleErase(c)}
                      >
                        Erase Profile (DPDP)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle>
            <DialogDescription>
              Phone is the client&apos;s portal identity — Indian mobile in +91
              format.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-phone">Phone (+91…)</Label>
              <Input
                id="client-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">Email (optional)</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="client-wa"
                checked={form.whatsappOptIn}
                onCheckedChange={(checked) =>
                  setForm({ ...form, whatsappOptIn: checked === true })
                }
              />
              <Label htmlFor="client-wa">WhatsApp messages allowed</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-notes">Notes (optional)</Label>
              <Textarea
                id="client-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save changes" : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* co-owner dialog */}
      <Dialog
        open={!!coOwnerFor}
        onOpenChange={(open) => !open && setCoOwnerFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add co-owner login</DialogTitle>
            <DialogDescription>
              A second portal login on {coOwnerFor?.name}&apos;s account
              (spouse / co-owner) with a different phone number.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCoOwner} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="co-name">Co-owner name</Label>
              <Input
                id="co-name"
                value={coOwner.name}
                onChange={(e) =>
                  setCoOwner({ ...coOwner, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-phone">Phone (+91…)</Label>
              <Input
                id="co-phone"
                type="tel"
                value={coOwner.phone}
                onChange={(e) =>
                  setCoOwner({ ...coOwner, phone: e.target.value })
                }
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCoOwnerFor(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create login"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
