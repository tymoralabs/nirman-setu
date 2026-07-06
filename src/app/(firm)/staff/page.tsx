import { forPage } from "@/lib/action-utils";
import { listAssociates } from "@/services/users.service";
import { StaffView } from "./staff-view";

export default async function StaffPage() {
  // associates hitting this page get a 404 (requireFirmAdmin inside)
  const associates = await forPage(listAssociates());

  return (
    <div className="p-8">
      <StaffView
        associates={associates.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email ?? "",
          status: a.status,
          lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
