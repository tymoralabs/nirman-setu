import { forPage } from "@/lib/action-utils";
import { globalSearch } from "@/services/search.service";
import { requireStaff } from "@/lib/authz";
import { SearchView } from "./search-view";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await forPage(requireStaff());
  const { q = "" } = await searchParams;

  const results = await forPage(globalSearch(q));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Global Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search projects, clients, and uploaded documents.
        </p>
      </div>

      <SearchView initialQuery={q} results={results} />
    </div>
  );
}
