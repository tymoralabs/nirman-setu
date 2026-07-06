"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { FolderKanban, Users, FileText, Search, ExternalLink, Download } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SearchResults {
  projects: { id: string; name: string; status: string }[];
  clients: { id: string; name: string; email: string | null }[];
  documents: { id: string; fileName: string; checklistId: string; projectId: string }[];
}

export function SearchView({
  initialQuery,
  results,
}: {
  initialQuery: string;
  results: SearchResults;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    });
  }

  const hasResults =
    results.projects.length > 0 ||
    results.clients.length > 0 ||
    results.documents.length > 0;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type search terms..."
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={pending}>
          Search
        </Button>
      </form>

      {query.trim() && !hasResults ? (
        <div className="text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-lg p-12 text-center">
          No matches found for "{query}". Try a different term.
        </div>
      ) : hasResults ? (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Projects Column */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
                <FolderKanban className="size-4 text-primary" />
                Projects ({results.projects.length})
              </h3>
              {results.projects.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching projects.</p>
              ) : (
                <div className="space-y-2">
                  {results.projects.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded border hover:bg-muted/10 transition-colors text-xs"
                    >
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                          Status: {p.status}
                        </p>
                      </div>
                      <Link
                        href={`/projects/${p.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clients Column */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
                <Users className="size-4 text-primary" />
                Clients ({results.clients.length})
              </h3>
              {results.clients.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching clients.</p>
              ) : (
                <div className="space-y-2">
                  {results.clients.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded border hover:bg-muted/10 transition-colors text-xs"
                    >
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">
                          {c.email || "No email"}
                        </p>
                      </div>
                      <Link
                        href={`/clients`}
                        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents Column */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 border-b pb-2">
                <FileText className="size-4 text-primary" />
                Documents ({results.documents.length})
              </h3>
              {results.documents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching documents.</p>
              ) : (
                <div className="space-y-2">
                  {results.documents.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-2 rounded border hover:bg-muted/10 transition-colors text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold truncate" title={d.fileName}>
                          {d.fileName}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          In checklist items
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Link
                          href={`/projects/${d.projectId}/checklists/${d.checklistId}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                        <a
                          href={`/api/download/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "flex items-center justify-center")}
                        >
                          <Download className="size-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground bg-muted/5 border border-dashed rounded-lg p-12 text-center">
          Enter a search query to search projects, clients, or uploaded files.
        </div>
      )}
    </div>
  );
}
