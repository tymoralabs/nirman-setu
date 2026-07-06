"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  X,
  MessageSquare,
  Upload,
  Download,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateIst, formatDateTimeIst } from "@/lib/dates";
import {
  updateChecklistItemStatusAction,
  toggleHardCopyReceivedAction,
  addCommentAction,
} from "../actions";
import { softDeleteDocumentAction } from "../../../../trash/actions";

interface ChecklistItem {
  id: string;
  title: string;
  titleHi: string | null;
  description: string | null;
  helpText: string | null;
  isMandatory: boolean;
  sortOrder: number;
  status: "pending" | "uploaded" | "received" | "rejected" | "waived";
  waivedReason: string | null;
  rejectionReason: string | null;
  hardCopyReceived: boolean;
}

interface Document {
  id: string;
  checklistItemId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageKey: string;
  createdAt: string;
  uploadedBy: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorRole: string;
}

interface Project {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

const ITEM_STATUS_STYLE: Record<ChecklistItem["status"], string> = {
  pending: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  uploaded: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  received: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  waived: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
};

const ITEM_STATUS_LABEL: Record<ChecklistItem["status"], string> = {
  pending: "Pending Upload",
  uploaded: "Awaiting Review",
  received: "Received & Approved",
  rejected: "Rejected",
  waived: "Waived",
};

export function ChecklistDetailView({
  projectId,
  checklist,
  items,
  documents,
  comments,
  project,
  client,
  isAdmin,
  viewerId,
  viewerName,
}: {
  projectId: string;
  checklist: {
    id: string;
    title: string;
    notes: string | null;
    status: string;
    sentAt: string | null;
    completedAt: string | null;
  };
  items: ChecklistItem[];
  documents: Document[];
  comments: Record<string, Comment[]>;
  project: Project;
  client: Client;
  isAdmin: boolean;
  viewerId: string;
  viewerName: string;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    items[0]?.id ?? null
  );
  const [pending, startTransition] = useTransition();

  // Reject / Waive dialogues
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [waiveReason, setWaiveReason] = useState("");

  // Comments state
  const [commentInput, setCommentInput] = useState("");
  const [localComments, setLocalComments] = useState<Record<string, Comment[]>>(comments);

  // File Upload states
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const selectedItemDocs = documents.filter(
    (d) => d.checklistItemId === selectedItemId
  );
  const selectedItemComments = localComments[selectedItemId ?? ""] ?? [];

  function handleStatusUpdate(
    status: "pending" | "received" | "rejected" | "waived",
    rejectionReason?: string,
    waivedReason?: string
  ) {
    if (!selectedItemId) return;
    startTransition(async () => {
      const res = await updateChecklistItemStatusAction(
        projectId,
        checklist.id,
        {
          itemId: selectedItemId,
          status,
          rejectionReason,
          waivedReason,
        }
      );

      if (res.ok) {
        toast.success(`Item status updated to ${status}.`);
        setRejectOpen(false);
        setWaiveOpen(false);
        setRejectReason("");
        setWaiveReason("");
        // Reload page to reflect changes
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleToggleHardCopy(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedItemId) return;
    const checked = e.target.checked;
    startTransition(async () => {
      const res = await toggleHardCopyReceivedAction(
        projectId,
        checklist.id,
        selectedItemId,
        checked
      );
      if (res.ok) {
        toast.success(checked ? "Physical copy logged." : "Physical copy removed.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItemId || !commentInput.trim()) return;

    const body = commentInput;
    setCommentInput("");

    startTransition(async () => {
      const res = await addCommentAction(
        projectId,
        checklist.id,
        selectedItemId,
        body
      );

      if (res.ok) {
        const newComment: Comment = {
          id: res.data.id,
          body: res.data.body,
          createdAt: new Date(res.data.createdAt),
          authorId: viewerId,
          authorName: viewerName,
          authorRole: "associate", // Or whatever the role is
        };
        setLocalComments((prev) => ({
          ...prev,
          [selectedItemId]: [...(prev[selectedItemId] ?? []), newComment],
        }));
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDeleteDoc(docId: string) {
    if (!confirm("Are you sure you want to move this file to the trash? It can be restored within 30 days.")) {
      return;
    }
    startTransition(async () => {
      const res = await softDeleteDocumentAction(projectId, checklist.id, docId);
      if (res.ok) {
        toast.success("Document moved to trash.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedItemId) return;

    setUploadingItemId(selectedItemId);

    try {
      // 1. Presign
      const res = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistItemId: selectedItemId,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "File type not allowed or size exceeds limit.");
        return;
      }

      // 2. Put directly to storage endpoint
      const uploadRes = await fetch(data.url, {
        method: data.method,
        headers: data.headers,
        body: file,
      });

      if (!uploadRes.ok) {
        toast.error("Failed to upload file to storage.");
        return;
      }

      // 3. Complete
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistItemId: selectedItemId,
          fileName: data.sanitizedName,
          fileSizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          storageKey: data.storageKey,
        }),
      });

      const completeData = await completeRes.json();
      if (completeRes.ok && completeData.ok) {
        toast.success("File uploaded successfully on client's behalf.");
        window.location.reload();
      } else {
        toast.error(completeData.error || "Failed to finalize upload.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Upload failed.");
    } finally {
      setUploadingItemId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to {project.name}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{checklist.title}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Client: <span className="font-semibold">{client.name}</span>
            </p>
          </div>
          <Badge variant={checklist.status === "completed" ? "default" : "secondary"}>
            Checklist: {checklist.status}
          </Badge>
        </div>
        {checklist.notes && (
          <p className="mt-3 text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg border">
            {checklist.notes}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side: Items List */}
        <div className="space-y-2 lg:col-span-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">
            Documents Requested
          </p>
          <div className="space-y-1.5">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`w-full text-left p-3.5 rounded-lg border text-sm transition-all focus:outline-none ${
                  selectedItemId === item.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-foreground block">
                    {item.title}
                    {item.isMandatory && <span className="text-destructive ml-0.5">*</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${ITEM_STATUS_STYLE[item.status]}`}
                  >
                    {ITEM_STATUS_LABEL[item.status]}
                  </span>
                  {item.hardCopyReceived && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      Hard Copy
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Detail Panel */}
        <div className="lg:col-span-2 space-y-6">
          {selectedItem ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 border-b">
                <div>
                  <CardTitle className="text-lg flex items-center gap-1.5">
                    {selectedItem.title}
                    {selectedItem.titleHi && (
                      <span className="text-muted-foreground text-xs font-normal">
                        ({selectedItem.titleHi})
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    {selectedItem.description || "No description provided."}
                  </CardDescription>
                </div>
                <Badge variant={selectedItem.isMandatory ? "destructive" : "secondary"}>
                  {selectedItem.isMandatory ? "Mandatory" : "Optional"}
                </Badge>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {selectedItem.helpText && (
                  <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-3.5 text-xs text-blue-800 dark:text-blue-300 flex gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">Instructions for Client</p>
                      <p>{selectedItem.helpText}</p>
                    </div>
                  </div>
                )}

                {/* File list */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Uploaded Documents</h4>
                  {selectedItemDocs.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-muted/10 border border-dashed p-6 rounded-lg text-center">
                      No files uploaded yet.
                    </p>
                  ) : (
                    <div className="divide-y border rounded-lg overflow-hidden bg-background">
                      {selectedItemDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 text-xs hover:bg-muted/10 transition-colors"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="font-medium text-foreground truncate">{doc.fileName}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB • Uploaded {formatDateTimeIst(doc.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`/api/download/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                            >
                              <Download className="size-3.5" />
                              Download
                            </a>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteDoc(doc.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Associate Reviews Section */}
                <div className="border-t pt-6 space-y-4">
                  <h4 className="text-sm font-semibold">Liaison Review</h4>

                  {/* Waive / Reject info */}
                  {selectedItem.status === "waived" && (
                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 p-3.5 rounded-lg text-xs text-purple-800 dark:text-purple-300">
                      <p className="font-semibold">Document Waived</p>
                      <p className="mt-1">Reason: {selectedItem.waivedReason}</p>
                    </div>
                  )}
                  {selectedItem.status === "rejected" && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3.5 rounded-lg text-xs text-red-800 dark:text-red-300">
                      <p className="font-semibold">Last Submission Rejected</p>
                      <p className="mt-1">Reason: {selectedItem.rejectionReason}</p>
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Approve / Reject actions */}
                    {selectedItem.status === "uploaded" && (
                      <>
                        <Button
                          onClick={() => handleStatusUpdate("received")}
                          disabled={pending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="size-4" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setRejectOpen(true)}
                          disabled={pending}
                        >
                          <X className="size-4" />
                          Reject
                        </Button>
                      </>
                    )}

                    {/* Waive / Un-waive toggle */}
                    {selectedItem.status === "waived" ? (
                      <Button
                        variant="outline"
                        onClick={() => handleStatusUpdate("pending")}
                        disabled={pending}
                      >
                        Un-waive Document
                      </Button>
                    ) : (
                      selectedItem.status !== "received" && (
                        <Button
                          variant="outline"
                          onClick={() => setWaiveOpen(true)}
                          disabled={pending}
                        >
                          Waive Document
                        </Button>
                      )
                    )}

                    {/* Hard copy checkbox */}
                    <div className="flex items-center gap-2 border px-3 py-2 rounded-lg text-xs font-medium cursor-pointer bg-muted/10 ml-auto select-none">
                      <input
                        type="checkbox"
                        id="hardCopy"
                        checked={selectedItem.hardCopyReceived}
                        onChange={handleToggleHardCopy}
                        disabled={pending}
                        className="cursor-pointer"
                      />
                      <label htmlFor="hardCopy" className="cursor-pointer">
                        Physical Original Received
                      </label>
                    </div>
                  </div>

                  {/* Upload on-behalf */}
                  <div className="flex items-center gap-3 border border-dashed rounded-lg p-3 bg-muted/10">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Client brought paper to office?</p>
                      <p className="text-[10px] text-muted-foreground">
                        Scan or photograph and upload it directly on their behalf.
                      </p>
                    </div>
                    <Label
                      htmlFor="onBehalfFile"
                      className={`ml-auto flex items-center gap-1.5 px-3 py-2 border rounded-lg bg-background text-xs font-medium cursor-pointer select-none hover:bg-muted/20 transition-all ${
                        uploadingItemId ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      <Upload className="size-3.5" />
                      {uploadingItemId ? "Uploading..." : "Upload File"}
                      <input
                        type="file"
                        id="onBehalfFile"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingItemId !== null || pending}
                      />
                    </Label>
                  </div>
                </div>

                {/* Comment thread */}
                <div className="border-t pt-6 space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageSquare className="size-4" />
                    Client Correspondence
                  </h4>

                  {selectedItemComments.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-muted/5 p-4 rounded-lg text-center">
                      No comments posted. Ask the client or add instructions here.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {selectedItemComments.map((c) => (
                        <div
                          key={c.id}
                          className={`rounded-lg p-3 text-xs space-y-1 max-w-[85%] ${
                            c.authorId === viewerId
                              ? "bg-primary/10 text-primary-foreground ml-auto border border-primary/20"
                              : "bg-muted text-muted-foreground border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 font-semibold text-[10px] border-b pb-1 mb-1">
                            <span className="capitalize">
                              {c.authorName} ({c.authorRole === "client" ? "Client" : "Staff"})
                            </span>
                            <span>{formatDateTimeIst(c.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                            {c.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <Input
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Type a message to the client..."
                      required
                    />
                    <Button type="submit" disabled={pending}>
                      Send
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground text-center">Select an item to review</p>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              State the reason for rejecting. This is sent to the client as a notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label htmlFor="rejectReason">Rejection Reason</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. The photocopy is blurry. Please scan the original page 3."
              rows={3}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleStatusUpdate("rejected", rejectReason)}
              disabled={pending || !rejectReason.trim()}
            >
              Reject Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive Modal */}
      <Dialog open={waiveOpen} onOpenChange={setWaiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waive Document Request</DialogTitle>
            <DialogDescription>
              Why can the client bypass uploading this mandatory document?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label htmlFor="waiveReason">Waive Reason</Label>
            <Textarea
              id="waiveReason"
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              placeholder="e.g. Client verified that NA Order is not required for commercial zones in this block."
              rows={3}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleStatusUpdate("waived", undefined, waiveReason)}
              disabled={pending || !waiveReason.trim()}
            >
              Waive Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
