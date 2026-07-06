"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Camera,
  Download,
  AlertCircle,
  X,
  MessageSquare,
  FileText,
  FileImage,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addClientCommentAction } from "../../actions";
import imageCompression from "browser-image-compression";
import { formatDateTimeIst } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface ClientChecklistItem {
  id: string;
  title: string;
  titleHi: string | null;
  description: string | null;
  helpText: string | null;
  isMandatory: boolean;
  status: "pending" | "uploaded" | "received" | "rejected" | "waived";
  rejectionReason: string | null;
  waivedReason: string | null;
}

interface Document {
  id: string;
  checklistItemId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageKey: string;
  createdAt: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorRole: string;
}

const ITEM_STATUS_STYLE: Record<ClientChecklistItem["status"], string> = {
  pending: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  uploaded: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  received: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  waived: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
};

export function ClientChecklistView({
  checklist,
  items,
  documents,
  comments,
  viewerId,
  viewerName,
}: {
  checklist: {
    id: string;
    title: string;
    notes: string | null;
    status: string;
  };
  items: ClientChecklistItem[];
  documents: Document[];
  comments: Record<string, Comment[]>;
  viewerId: string;
  viewerName: string;
}) {
  const t = useTranslations("Portal");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id ?? null);
  const [pending, startTransition] = useTransition();

  // Comments state
  const [commentInput, setCommentInput] = useState("");
  const [localComments, setLocalComments] = useState<Record<string, Comment[]>>(comments);

  // File Upload states
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);

  // Multi-photo state
  const [cameraPhotos, setCameraPhotos] = useState<{ file: File; preview: string }[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const selectedItemDocs = documents.filter((d) => d.checklistItemId === selectedItemId);
  const selectedItemComments = localComments[selectedItemId ?? ""] ?? [];

  async function uploadSingleFile(file: File) {
    if (!selectedItemId) return;
    setUploading(true);

    try {
      // 1. Presign URL
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
        toast.error(data.error || t("uploadFailed"));
        return;
      }

      // 2. Put file to signed URL
      const uploadRes = await fetch(data.url, {
        method: data.method,
        headers: data.headers,
        body: file,
      });

      if (!uploadRes.ok) {
        toast.error(t("uploadFailed"));
        return;
      }

      // 3. Complete Upload
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
        toast.success(t("uploadSuccess"));
        window.location.reload();
      } else {
        toast.error(completeData.error || t("uploadFailed"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  // Camera multi-capture flow
  function handleCameraFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setCameraPhotos((prev) => [...prev, ...newPhotos]);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setCameraPhotos((prev) => {
      const copy = [...prev];
      const removed = copy.splice(index, 1)[0];
      if (removed) URL.revokeObjectURL(removed.preview);
      return copy;
    });
  }

  async function handleMergeAndUpload() {
    if (!selectedItemId || cameraPhotos.length === 0) return;
    setCompressing(true);
    setUploading(true);

    try {
      const compressedFiles: File[] = [];

      // Compress client side
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 2200,
        useWebWorker: true,
      };

      for (let i = 0; i < cameraPhotos.length; i++) {
        toast.loading(`Compressing page ${i + 1} of ${cameraPhotos.length}...`, { id: "compress" });
        const compressed = await imageCompression(cameraPhotos[i].file, options);
        compressedFiles.push(compressed);
      }
      toast.dismiss("compress");

      // Upload each page individually to storage to get their keys
      const storageKeys: string[] = [];
      for (let i = 0; i < compressedFiles.length; i++) {
        toast.loading(`Uploading page ${i + 1} of ${compressedFiles.length}...`, { id: "upload-page" });
        const file = compressedFiles[i];

        const res = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checklistItemId: selectedItemId,
            fileName: `page-${i + 1}.jpg`,
            fileSizeBytes: file.size,
            mimeType: "image/jpeg",
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Presign failed");
        }

        const uploadRes = await fetch(data.url, {
          method: data.method,
          headers: data.headers,
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload page ${i + 1}`);
        }

        storageKeys.push(data.storageKey);
      }
      toast.dismiss("upload-page");

      // Request server to merge all uploaded keys into a single PDF
      toast.loading("Merging photos into PDF...", { id: "merge" });
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistItemId: selectedItemId,
          fileName: `${selectedItem?.title.replace(/\s+/g, "_") || "Merged"}.pdf`,
          fileSizeBytes: 1, // Will be calculated by server
          mimeType: "application/pdf",
          storageKeys,
        }),
      });
      toast.dismiss("merge");

      const completeData = await completeRes.json();
      if (completeRes.ok && completeData.ok) {
        toast.success(t("uploadSuccess"));
        setCameraPhotos([]);
        window.location.reload();
      } else {
        toast.error(completeData.error || t("uploadFailed"));
      }
    } catch (err) {
      console.error(err);
      toast.dismiss("compress");
      toast.dismiss("upload-page");
      toast.dismiss("merge");
      toast.error(t("uploadFailed"));
    } finally {
      setCompressing(false);
      setUploading(false);
    }
  }

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItemId || !commentInput.trim()) return;

    const body = commentInput;
    setCommentInput("");

    startTransition(async () => {
      const res = await addClientCommentAction(checklist.id, selectedItemId, body);
      if (res.ok) {
        const newComment: Comment = {
          id: res.data.id,
          body: res.data.body,
          createdAt: new Date(res.data.createdAt),
          authorId: viewerId,
          authorName: viewerName,
          authorRole: "client",
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to Portal
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold">{checklist.title}</h1>
        {checklist.notes && (
          <p className="mt-2 text-sm text-muted-foreground bg-background p-3 rounded-lg border">
            {checklist.notes}
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column: Checklist Items */}
        <div className="md:col-span-1 space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedItemId(item.id);
                setCameraPhotos([]);
              }}
              className={`w-full text-left p-3 rounded-lg border text-sm transition-all focus:outline-none ${
                selectedItemId === item.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <span className="font-semibold block truncate">
                  {item.title}
                  {item.isMandatory && <span className="text-destructive ml-0.5">*</span>}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${ITEM_STATUS_STYLE[item.status]}`}
                >
                  {t(`status.${item.status}`)}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Right column: Upload details & actions */}
        <div className="md:col-span-2">
          {selectedItem ? (
            <Card className="sticky top-20">
              <CardHeader className="pb-4 border-b">
                <div className="flex items-start justify-between gap-2">
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
                      {selectedItem.description}
                    </CardDescription>
                  </div>
                  <Badge variant={selectedItem.isMandatory ? "destructive" : "secondary"}>
                    {selectedItem.isMandatory ? t("mandatory") : t("optional")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {selectedItem.helpText && (
                  <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 p-3.5 text-xs text-blue-800 dark:text-blue-300 flex gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">{t("help")}</p>
                      <p>{selectedItem.helpText}</p>
                    </div>
                  </div>
                )}

                {/* Rejected/Waived feedback */}
                {selectedItem.status === "rejected" && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 p-3.5 text-xs text-red-800 dark:text-red-300">
                    <p className="font-semibold">{t("rejectionTitle")}</p>
                    <p className="mt-1">{t("rejectionReason", { reason: selectedItem.rejectionReason ?? "" })}</p>
                  </div>
                )}
                {selectedItem.status === "waived" && (
                  <div className="rounded-lg bg-purple-50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/30 p-3.5 text-xs text-purple-800 dark:text-purple-300">
                    <p className="font-semibold">{t("waiveTitle")}</p>
                    <p className="mt-1">{t("waiveReason", { reason: selectedItem.waivedReason ?? "" })}</p>
                  </div>
                )}

                {/* Upload Section */}
                {selectedItem.status !== "received" && selectedItem.status !== "waived" && (
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/5">
                    <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                      Upload document
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* File Upload Button */}
                      <label className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg cursor-pointer bg-background hover:bg-muted/10 transition-colors">
                        <Upload className="size-6 text-muted-foreground mb-2" />
                        <span className="text-xs font-semibold">{t("uploadButton")}</span>
                        <span className="text-[10px] text-muted-foreground mt-1">PDF, JPG, PNG, WEBP</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.dwg,.zip"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadSingleFile(file);
                          }}
                        />
                      </label>

                      {/* Camera Capture Button */}
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploading}
                        className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg cursor-pointer bg-background hover:bg-muted/10 transition-colors focus:outline-none"
                      >
                        <Camera className="size-6 text-muted-foreground mb-2" />
                        <span className="text-xs font-semibold">{t("cameraButton")}</span>
                        <span className="text-[10px] text-muted-foreground mt-1">Snap multiple pages</span>
                        <input
                          type="file"
                          ref={cameraInputRef}
                          className="hidden"
                          accept="image/*"
                          multiple
                          capture="environment"
                          onChange={handleCameraFileChange}
                        />
                      </button>
                    </div>

                    {/* Camera Photos Preview Strip */}
                    {cameraPhotos.length > 0 && (
                      <div className="space-y-3 pt-3 border-t">
                        <p className="text-xs font-bold text-muted-foreground">{t("cameraPreview")}</p>
                        <div className="flex flex-wrap gap-2.5">
                          {cameraPhotos.map((photo, index) => (
                            <div key={index} className="relative size-16 border rounded bg-muted overflow-hidden">
                              <img src={photo.preview} className="object-cover w-full h-full" alt="captured" />
                              <button
                                onClick={() => removePhoto(index)}
                                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <Button
                          onClick={handleMergeAndUpload}
                          disabled={uploading}
                          className="w-full text-xs"
                        >
                          {t("mergeBtn")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Uploaded documents view */}
                {selectedItemDocs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Submissions
                    </h4>
                    <div className="divide-y border rounded-lg bg-background">
                      {selectedItemDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 text-xs">
                          <div className="min-w-0 pr-3 flex items-center gap-2">
                            {doc.mimeType.includes("pdf") ? (
                              <FileText className="size-4 shrink-0 text-red-500" />
                            ) : (
                              <FileImage className="size-4 shrink-0 text-blue-500" />
                            )}
                            <span className="font-medium truncate">{doc.fileName}</span>
                          </div>
                           <a
                             href={`/api/download/${doc.id}`}
                             target="_blank"
                             rel="noopener noreferrer"
                             className={cn(buttonVariants({ variant: "outline", size: "sm" }), "size-8 p-0 flex items-center justify-center")}
                           >
                             <Download className="size-3.5" />
                           </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discussion threads */}
                <div className="border-t pt-6 space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageSquare className="size-4" />
                    {t("comments")}
                  </h4>

                  {selectedItemComments.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-muted/5 p-4 rounded-lg text-center">
                      No correspondence history. Need help? Post a query below.
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
                              {c.authorId === viewerId ? viewerName : c.authorName} ({c.authorRole === "client" ? "You" : "Architect"})
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
                      placeholder={t("commentPlaceholder")}
                      required
                    />
                    <Button type="submit" disabled={pending}>
                      {t("commentSend")}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground text-center">Select an item</p>
          )}
        </div>
      </div>
    </div>
  );
}
