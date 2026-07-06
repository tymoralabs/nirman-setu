"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateIst } from "@/lib/dates";
import { restoreDocumentAction } from "./actions";
import Link from "next/link";

interface TrashItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  deletedAt: string;
  itemTitle: string;
  projectName: string;
}

export function TrashView({ items }: { items: TrashItem[] }) {
  const [pending, startTransition] = useTransition();

  function handleRestore(id: string) {
    startTransition(async () => {
      const res = await restoreDocumentAction(id);
      if (res.ok) {
        toast.success("Document restored successfully.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/5">
            <Trash className="size-10 text-muted-foreground/40 mb-4" />
            <p className="font-semibold">Trash is empty</p>
            <p className="text-xs mt-1">No soft-deleted files are pending purge.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Requested In</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Deleted On</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={item.fileName}>
                      {item.fileName}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(item.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.itemTitle}
                    </TableCell>
                    <TableCell className="text-xs">{item.projectName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateIst(item.deletedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleRestore(item.id)}
                        className="h-8 gap-1.5"
                      >
                        <RotateCcw className="size-3.5" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
