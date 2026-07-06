import { redirect } from "next/navigation";
import { AuthError, NotFoundError, requireStaff } from "@/lib/authz";
import { getCurrentFirm } from "@/services/firm.service";
import { SignOutButton } from "@/components/sign-out-button";
import { SidebarNav } from "./sidebar-nav";

export default async function FirmLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let user: Awaited<ReturnType<typeof requireStaff>>;
  let firm: Awaited<ReturnType<typeof getCurrentFirm>>;
  try {
    user = await requireStaff();
    firm = await getCurrentFirm();
  } catch (err) {
    if (err instanceof AuthError || err instanceof NotFoundError) {
      redirect("/login");
    }
    throw err;
  }

  return (
    <div className="flex flex-col min-h-screen w-full">
      {user.supportReadOnly && (
        <div className="bg-amber-600 text-white px-6 py-2 flex items-center justify-between text-xs font-semibold shrink-0">
          <span>
            Support Impersonation Mode (Read-Only) — Viewing {firm.name} as admin.
          </span>
          <form
            action={async () => {
              "use server";
              const { cookies } = await import("next/headers");
              (await cookies()).delete("impersonate_firm_id");
              const { redirect } = await import("next/navigation");
              redirect("/platform");
            }}
          >
            <button
              type="submit"
              className="bg-white/20 hover:bg-white/35 text-white px-2.5 py-1 rounded transition-colors"
            >
              Exit Impersonation
            </button>
          </form>
        </div>
      )}
      <div className="flex flex-1 min-h-0 w-full">
        <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/30">
          <div className="border-b p-4">
            <p className="truncate font-semibold">{firm.name}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {firm.planTier} plan
            </p>
          </div>
          <SidebarNav isAdmin={user.role === "firm_admin"} />
          <div className="mt-auto space-y-2 border-t p-4">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {user.role === "firm_admin" ? "Firm admin" : "Associate"}
            </p>
            <SignOutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
