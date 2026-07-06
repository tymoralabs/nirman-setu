import { forPage } from "@/lib/action-utils";
import { listLibraryItems } from "@/services/library.service";
import { LibraryView } from "./library-view";

export default async function LibraryPage() {
  const items = await forPage(listLibraryItems());

  return (
    <div className="p-8">
      <LibraryView
        items={items.map((i) => ({
          id: i.id,
          title: i.title,
          titleHi: i.titleHi,
          category: i.category,
          helpText: i.helpText,
          isActive: i.isActive,
        }))}
      />
    </div>
  );
}
