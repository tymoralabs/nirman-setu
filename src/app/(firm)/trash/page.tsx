import { forPage } from "@/lib/action-utils";
import { listTrashItems } from "@/services/trash.service";
import { requireStaff } from "@/lib/authz";
import { TrashView } from "./trash-view";

export default async function TrashPage() {
  const staff = await requireStaff();
  const items = await forPage(listTrashItems());

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trash / Soft Deletes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Documents deleted by staff remain here for 30 days before being permanently purged.
        </p>
      </div>

      <TrashView
        items={items.map((i) => ({
          id: i.id,
          fileName: i.fileName,
          fileSizeBytes: i.fileSizeBytes,
          mimeType: i.mimeType,
          deletedAt: i.deletedAt ? i.deletedAt.toISOString() : "",
          itemTitle: i.itemTitle,
          projectName: i.projectName,
        }))}
      />
    </div>
  );
}
