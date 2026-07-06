import { forPage } from "@/lib/action-utils";
import { getChecklistDetail, listComments } from "@/services/checklists.service";
import { requireRole } from "@/lib/authz";
import { ClientChecklistView } from "./client-checklist-view";

export default async function ClientChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await forPage(requireRole("client"));

  const { checklist, items, documents } = await forPage(
    getChecklistDetail(id)
  );

  // Fetch comments for each item
  const commentsList = await Promise.all(
    items.map(async (item) => {
      const itemComments = await forPage(listComments(item.id));
      return [item.id, itemComments] as const;
    })
  );
  const commentsMap = Object.fromEntries(commentsList);

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <ClientChecklistView
        checklist={{
          id: checklist.id,
          title: checklist.title,
          notes: checklist.notes,
          status: checklist.status,
        }}
        items={items.map((i) => ({
          id: i.id,
          title: i.title,
          titleHi: i.titleHi,
          description: i.description,
          helpText: i.helpText,
          isMandatory: i.isMandatory,
          status: i.status,
          rejectionReason: i.rejectionReason,
          waivedReason: i.waivedReason,
        }))}
        documents={documents.map((d) => ({
          id: d.id,
          checklistItemId: d.checklistItemId,
          fileName: d.fileName,
          fileSizeBytes: d.fileSizeBytes,
          mimeType: d.mimeType,
          storageKey: d.storageKey,
          createdAt: d.createdAt.toISOString(),
        }))}
        comments={commentsMap}
        viewerId={user.id}
        viewerName={user.name ?? "Client"}
      />
    </div>
  );
}
