import { forPage } from "@/lib/action-utils";
import { getFirmDashboardStats } from "@/services/dashboard.service";
import { requireStaff } from "@/lib/authz";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDateIst, daysSince } from "@/lib/dates";
import Link from "next/link";
import { AlertTriangle, CheckCircle, FileText, LayoutDashboard } from "lucide-react";

export default async function DashboardPage() {
  const user = await forPage(requireStaff());
  const stats = await forPage(getFirmDashboardStats());

  const storageUsedMb = (stats.storageUsedBytes / (1024 * 1024)).toFixed(1);
  const storageLimitGb = (stats.maxStorageBytes / (1024 * 1024 * 1024)).toFixed(0);
  const storagePercent = (stats.storageUsedBytes / stats.maxStorageBytes) * 100;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <LayoutDashboard className="size-6 text-muted-foreground" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {user.name ?? "there"}. Here is your firm's current status.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">
              Active Projects
            </CardDescription>
            <CardTitle className="text-3xl font-semibold">
              {stats.activeProjectsCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-1">
            Projects currently in liaison.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">
              Awaiting Review
            </CardDescription>
            <CardTitle className="text-3xl font-semibold text-amber-600 dark:text-amber-500">
              {stats.awaitingReviewCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-1">
            Client document uploads pending approval.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider flex justify-between">
              <span>Storage Used</span>
              <span>{storageUsedMb} MB / {storageLimitGb} GB</span>
            </CardDescription>
            <div className="pt-2">
              <Progress value={storagePercent} className="h-2" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-1">
            Total space consumed by checklist documents.
          </CardContent>
        </Card>
      </div>

      {/* Stuck projects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Attention Needed (Stuck Clients)
          </CardTitle>
          <CardDescription>
            Firms projects where client upload activity has stalled for more than 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.stuckProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <CheckCircle className="size-10 text-emerald-500 mb-2" />
              <p className="font-semibold">All projects are active</p>
              <p className="text-xs mt-1">No client accounts currently flagged as stuck.</p>
            </div>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden bg-background">
              {stats.stuckProjects.map((p) => {
                const days = p.lastActivityAt ? daysSince(p.lastActivityAt) : null;
                return (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/10 transition-colors gap-3"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-semibold text-sm hover:underline text-primary"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Client: <span className="font-medium text-foreground">{p.clientName}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="bg-red-50 text-red-700 border border-red-200 rounded px-2.5 py-1 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900">
                        {p.pendingItemsCount} items pending
                      </div>

                      <div className="text-muted-foreground font-medium">
                        {days !== null ? (
                          <span className="text-destructive font-semibold">
                            No uploads for {days} days
                          </span>
                        ) : (
                          <span className="text-destructive font-semibold">
                            No uploads since checklist created
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
