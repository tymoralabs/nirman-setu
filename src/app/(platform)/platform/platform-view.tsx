"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Shield, HardDrive, FolderKanban } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateIst } from "@/lib/dates";
import { impersonateFirmAction } from "./actions";

interface FirmRow {
  id: string;
  name: string;
  planTier: "silver" | "gold" | "platinum";
  status: "active" | "suspended" | "pending_deletion";
  storageUsedBytes: number;
  createdAt: string;
  projectsCount: number;
}

export function PlatformView({ firms }: { firms: FirmRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const totalFirms = firms.length;
  const activeFirms = firms.filter((f) => f.status === "active").length;
  const totalStorageBytes = firms.reduce((acc, curr) => acc + curr.storageUsedBytes, 0);
  const totalStorageMb = (totalStorageBytes / (1024 * 1024)).toFixed(1);

  function handleImpersonate(firmId: string) {
    startTransition(async () => {
      const res = await impersonateFirmAction(firmId);
      if (res.ok) {
        toast.success("Impersonation started.");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">
              Total Active Tenants
            </CardDescription>
            <CardTitle className="text-3xl font-semibold">{activeFirms} / {totalFirms}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-1">
            Registered liaison firms.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">
              Platform Storage
            </CardDescription>
            <CardTitle className="text-3xl font-semibold flex items-center gap-2">
              <HardDrive className="size-6 text-muted-foreground" />
              {totalStorageMb} MB
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-1">
            Total files uploaded by all tenants combined.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">
              Projects Tracked
            </CardDescription>
            <CardTitle className="text-3xl font-semibold flex items-center gap-2">
              <FolderKanban className="size-6 text-muted-foreground" />
              {firms.reduce((acc, curr) => acc + curr.projectsCount, 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-1">
            Total active & completed projects.
          </CardContent>
        </Card>
      </div>

      {/* Firms Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registered Firms</CardTitle>
          <CardDescription>
            View all firms using the platform. Use "View" to enter staff impersonation mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firm Name</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active Projects</TableHead>
                <TableHead>Storage Used</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {firms.map((firm) => (
                <TableRow key={firm.id}>
                  <TableCell className="font-semibold text-sm">{firm.name}</TableCell>
                  <TableCell className="capitalize text-xs font-semibold">
                    <Badge variant={firm.planTier === "silver" ? "secondary" : "default"}>
                      {firm.planTier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={firm.status === "active" ? "default" : "destructive"}>
                      {firm.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{firm.projectsCount}</TableCell>
                  <TableCell className="text-xs">
                    {(firm.storageUsedBytes / (1024 * 1024)).toFixed(2)} MB
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateIst(firm.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || firm.status !== "active"}
                      onClick={() => handleImpersonate(firm.id)}
                      className="h-8 gap-1.5"
                    >
                      <Eye className="size-3.5" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
