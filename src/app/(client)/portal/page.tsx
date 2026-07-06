import { cookies } from "next/headers";
import { requireRole } from "@/lib/authz";
import { forPage } from "@/lib/action-utils";
import { listClientChecklists } from "@/services/checklists.service";
import { SignOutButton } from "@/components/sign-out-button";
import { PortalDashboardView } from "./portal-dashboard-view";
import { APP_NAME } from "@/lib/config";

export default async function PortalPage() {
  const user = await forPage(requireRole("client"));
  const cookieStore = await cookies();
  const currentLocale = cookieStore.get("NEXT_LOCALE")?.value || "en";

  const checklists = await forPage(listClientChecklists(user.clientId!));

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{APP_NAME} Portal</h1>
        </div>

        <div className="flex items-center gap-4">
          <SignOutButton />
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <PortalDashboardView
          viewerName={user.name!}
          checklists={checklists.map((c) => ({
            id: c.id,
            title: c.title,
            status: c.status as "sent" | "in_progress" | "completed",
            createdAt: c.createdAt.toISOString(),
            projectName: c.projectName,
            totalItems: c.totalItems,
            completedItems: c.completedItems,
          }))}
          currentLocale={currentLocale}
        />
      </main>
    </div>
  );
}
