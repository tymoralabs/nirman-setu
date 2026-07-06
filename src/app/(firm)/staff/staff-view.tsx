"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeIst } from "@/lib/dates";
import { disableAssociateAction, inviteAssociateAction } from "./actions";

interface AssociateRow {
  id: string;
  name: string;
  email: string;
  status: "invited" | "active" | "disabled";
  lastLoginAt: string | null;
}

const STATUS_VARIANT = {
  active: "default",
  invited: "secondary",
  disabled: "outline",
} as const;

export function StaffView({ associates }: { associates: AssociateRow[] }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await inviteAssociateAction({ name, email });
      if (res.ok) {
        toast.success(`Invite sent to ${email}. It expires in 24 hours.`);
        setInviteOpen(false);
        setName("");
        setEmail("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDisable(row: AssociateRow) {
    startTransition(async () => {
      const res = await disableAssociateAction(row.id);
      if (res.ok) toast.success(`${row.name} has been disabled.`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Associate architects in your firm
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus data-icon="inline-start" />
          Invite associate
        </Button>
      </div>

      {associates.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No associates yet. Invite your first associate to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {associates.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{a.email}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[a.status]} className="capitalize">
                    {a.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTimeIst(a.lastLoginAt)}</TableCell>
                <TableCell>
                  {a.status !== "disabled" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleDisable(a)}
                    >
                      Disable
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite associate</DialogTitle>
            <DialogDescription>
              They will receive an email link to set their password. The link
              expires in 24 hours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
