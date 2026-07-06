"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createLibraryItemAction,
  setLibraryItemActiveAction,
  updateLibraryItemAction,
} from "./actions";

interface LibraryItemRow {
  id: string;
  title: string;
  titleHi: string | null;
  category: string;
  helpText: string | null;
  isActive: boolean;
}

interface ItemForm {
  title: string;
  titleHi: string;
  category: string;
  helpText: string;
}

const EMPTY_FORM: ItemForm = {
  title: "",
  titleHi: "",
  category: "",
  helpText: "",
};

export function LibraryView({ items }: { items: LibraryItemRow[] }) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItemRow | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.titleHi ?? "").toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, LibraryItemRow[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(item: LibraryItemRow) {
    setEditing(item);
    setForm({
      title: item.title,
      titleHi: item.titleHi ?? "",
      category: item.category,
      helpText: item.helpText ?? "",
    });
    setDialogOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = editing
        ? await updateLibraryItemAction(editing.id, form)
        : await createLibraryItemAction(form);
      if (res.ok) {
        toast.success(editing ? "Item updated." : "Item added to library.");
        setDialogOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleToggleActive(item: LibraryItemRow, isActive: boolean) {
    startTransition(async () => {
      const res = await setLibraryItemActiveAction(item.id, isActive);
      if (res.ok) {
        toast.success(
          isActive ? `"${item.title}" reactivated.` : `"${item.title}" deactivated.`
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Checklist library</h1>
          <p className="text-sm text-muted-foreground">
            Reusable document types your firm collects
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Add item
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title or category…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "The library is empty. Add your first document type."
            : "No items match your search."}
        </p>
      ) : (
        grouped.map(([category, categoryItems]) => (
          <section key={category} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </h2>
            <ul className="divide-y rounded-lg border">
              {categoryItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      {item.titleHi && (
                        <span className="text-sm text-muted-foreground">
                          {item.titleHi}
                        </span>
                      )}
                      {!item.isActive && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    {item.helpText && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {item.helpText}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${item.title}`}
                    onClick={() => openEdit(item)}
                  >
                    <Pencil />
                  </Button>
                  <Switch
                    checked={item.isActive}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      handleToggleActive(item, checked === true)
                    }
                    aria-label={`${item.title} active`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit library item" : "Add library item"}
            </DialogTitle>
            <DialogDescription>
              Help text is shown to clients in plain language — what the
              document is and where to get it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-title">Title</Label>
              <Input
                id="item-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-title-hi">Hindi title (optional)</Label>
              <Input
                id="item-title-hi"
                value={form.titleHi}
                onChange={(e) => setForm({ ...form, titleHi: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-category">Category</Label>
              <Input
                id="item-category"
                list="library-categories"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                required
              />
              <datalist id="library-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-help">Help text (optional)</Label>
              <Textarea
                id="item-help"
                placeholder="What is this document and where does the client get it?"
                value={form.helpText}
                onChange={(e) =>
                  setForm({ ...form, helpText: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save changes" : "Add item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
