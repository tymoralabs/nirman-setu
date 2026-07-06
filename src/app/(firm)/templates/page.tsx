import { forPage } from "@/lib/action-utils";
import { listTemplatesWithItems } from "@/services/templates.service";
import { listLibraryItems } from "@/services/library.service";
import { TemplatesView } from "./templates-view";

export default async function TemplatesPage() {
  const [templates, libraryItems] = await Promise.all([
    forPage(listTemplatesWithItems()),
    forPage(listLibraryItems()),
  ]);

  return (
    <div className="p-8">
      <TemplatesView
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          isActive: t.isActive,
          items: t.items.map((i) => ({
            libraryItemId: i.libraryItemId,
            isMandatory: i.isMandatory,
            title: i.title,
            category: i.category,
          })),
        }))}
        libraryItems={libraryItems
          .filter((i) => i.isActive)
          .map((i) => ({
            id: i.id,
            title: i.title,
            category: i.category,
          }))}
      />
    </div>
  );
}
