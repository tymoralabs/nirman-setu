import { forPage } from "@/lib/action-utils";
import { getChecklistDetail, listComments } from "@/services/checklists.service";
import { getProjectDetail } from "@/services/projects.service";
import { requireUser } from "@/lib/authz";
import { ChecklistDetailView } from "./checklist-detail-view";

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string; checklistId: string }>;
}) {
  const { id: projectId, checklistId } = await params;
  const user = await forPage(requireUser());
  const isAdmin = user.role === "firm_admin";

  const { checklist, items, documents } = await forPage(
    getChecklistDetail(checklistId)
  );

  const { project, client } = await forPage(getProjectDetail(projectId));

  // Fetch comments for all items
  const commentsList = await Promise.all(
    items.map(async (item) => {
      const itemComments = await forPage(listComments(item.id));
      return [item.id, itemComments] as const;
    })
  );
  const commentsMap = Object.fromEntries(commentsList);

  return (
    <div className="p-8">
      <ChecklistDetailView
        projectId={projectId}
        checklist={{
          id: checklist.id,
          title: checklist.title,
          notes: checklist.notes,
          status: checklist.status,
          sentAt: checklist.sentAt?.toISOString() ?? null,
          completedAt: checklist.completedAt?.toISOString() ?? null,
        }}
        items={items.map((i) => ({
          id: i.id,
          title: i.title,
          titleHi: i.titleHi,
          description: i.description,
          helpText: i.helpText,
          isMandatory: i.isMandatory,
          sortOrder: i.sortOrder,
          status: i.status,
          waivedReason: i.waivedReason,
          rejectionReason: i.rejectionReason,
          hardCopyReceived: i.hardCopyReceived,
        }))}
        documents={documents.map((d) => ({
          id: d.id,
          checklistItemId: d.checklistItemId,
          fileName: d.fileName,
          fileSizeBytes: d.fileSizeBytes,
          mimeType: d.mimeType,
          storageKey: d.storageKey,
          createdAt: d.createdAt.toISOString(),
          uploadedBy: d.uploadedBy,
        }))}
        comments={commentsMap}
        project={{
          id: project.id,
          name: project.name,
        }}
        client={client}
        isAdmin={isAdmin}
        viewerId={user.id}
        viewerName={user.name ?? "Staff"}
      />
    </div>
  );
}
