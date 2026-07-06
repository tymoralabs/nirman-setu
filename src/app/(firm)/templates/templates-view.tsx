"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTemplateAction,
  setTemplateActiveAction,
  updateTemplateAction,
} from "./actions";

interface LibraryOption {
  id: string;
  title: string;
  category: string;
}

interface TemplateItem {
  libraryItemId: string;
  isMandatory: boolean;
  title: string;
  category: string;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  items: TemplateItem[];
}

interface EditorState {
  /** null = creating */
  templateId: string | null;
  name: string;
  description: string;
  items: TemplateItem[];
}

export function TemplatesView({
  templates,
  libraryItems,
}: {
  templates: TemplateRow[];
  libraryItems: LibraryOption[];
}) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditor({ templateId: null, name: "", description: "", items: [] });
  }

  function openEdit(t: TemplateRow) {
    setEditor({
      templateId: t.id,
      name: t.name,
      description: t.description ?? "",
      items: t.items.map((i) => ({ ...i })),
    });
  }

  function handleToggleActive(t: TemplateRow, isActive: boolean) {
    startTransition(async () => {
      const res = await setTemplateActiveAction(t.id, isActive);
      if (res.ok) {
        toast.success(
          isActive ? `"${t.name}" reactivated.` : `"${t.name}" deactivated.`
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
          <h1 className="text-2xl font-semibold">Checklist templates</h1>
          <p className="text-sm text-muted-foreground">
            Preset document lists — one click away from a project checklist
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No templates yet. Compose one from your library items.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {t.name}
                      {!t.isActive && <Badge variant="outline">Inactive</Badge>}
                    </CardTitle>
                    {t.description && (
                      <CardDescription>{t.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => openEdit(t)}
                    >
                      <Pencil />
                    </Button>
                    <Switch
                      checked={t.isActive}
                      disabled={pending}
                      onCheckedChange={(checked) =>
                        handleToggleActive(t, checked === true)
                      }
                      aria-label={`${t.name} active`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm text-muted-foreground">
                  {t.items.length} items (
                  {t.items.filter((i) => i.isMandatory).length} mandatory)
                </p>
                <ol className="list-inside list-decimal space-y-0.5 text-sm">
                  {t.items.slice(0, 6).map((i) => (
                    <li key={i.libraryItemId}>
                      {i.title}
                      {!i.isMandatory && (
                        <span className="text-muted-foreground"> (optional)</span>
                      )}
                    </li>
                  ))}
                  {t.items.length > 6 && (
                    <li className="list-none text-muted-foreground">
                      … and {t.items.length - 6} more
                    </li>
                  )}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editor && (
        <TemplateEditorDialog
          editor={editor}
          setEditor={setEditor}
          libraryItems={libraryItems}
        />
      )}
    </div>
  );
}

function TemplateEditorDialog({
  editor,
  setEditor,
  libraryItems,
}: {
  editor: EditorState;
  setEditor: (e: EditorState | null) => void;
  libraryItems: LibraryOption[];
}) {
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedIds = useMemo(
    () => new Set(editor.items.map((i) => i.libraryItemId)),
    [editor.items]
  );

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return libraryItems;
    return libraryItems.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [libraryItems, search]);

  function toggleItem(option: LibraryOption, include: boolean) {
    if (include) {
      if (selectedIds.has(option.id)) return;
      setEditor({
        ...editor,
        items: [
          ...editor.items,
          {
            libraryItemId: option.id,
            isMandatory: true,
            title: option.title,
            category: option.category,
          },
        ],
      });
    } else {
      setEditor({
        ...editor,
        items: editor.items.filter((i) => i.libraryItemId !== option.id),
      });
    }
  }

  function setMandatory(libraryItemId: string, isMandatory: boolean) {
    setEditor({
      ...editor,
      items: editor.items.map((i) =>
        i.libraryItemId === libraryItemId ? { ...i, isMandatory } : i
      ),
    });
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...editor.items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEditor({ ...editor, items: next });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: editor.name,
      description: editor.description || undefined,
      items: editor.items.map((i) => ({
        libraryItemId: i.libraryItemId,
        isMandatory: i.isMandatory,
      })),
    };
    startTransition(async () => {
      const res = editor.templateId
        ? await updateTemplateAction(editor.templateId, payload)
        : await createTemplateAction(payload);
      if (res.ok) {
        toast.success(
          editor.templateId ? "Template updated." : "Template created."
        );
        setEditor(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && setEditor(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editor.templateId ? "Edit template" : "New template"}
          </DialogTitle>
          <DialogDescription>
            Pick library items, mark which are mandatory and order them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={editor.name}
                onChange={(e) =>
                  setEditor({ ...editor, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description (optional)</Label>
              <Textarea
                id="tpl-desc"
                rows={1}
                value={editor.description}
                onChange={(e) =>
                  setEditor({ ...editor, description: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* library picker */}
            <div className="space-y-2">
              <Label>Library items</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search library…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
                {filteredLibrary.length === 0 && (
                  <li className="p-2 text-sm text-muted-foreground">
                    No matching items.
                  </li>
                )}
                {filteredLibrary.map((option) => (
                  <li
                    key={option.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      id={`pick-${option.id}`}
                      checked={selectedIds.has(option.id)}
                      onCheckedChange={(checked) =>
                        toggleItem(option, checked === true)
                      }
                    />
                    <Label
                      htmlFor={`pick-${option.id}`}
                      className="min-w-0 flex-1 cursor-pointer font-normal"
                    >
                      <span className="block truncate">{option.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {option.category}
                      </span>
                    </Label>
                  </li>
                ))}
              </ul>
            </div>

            {/* selected items with order + mandatory */}
            <div className="space-y-2">
              <Label>
                Selected ({editor.items.length}) — order &amp; mandatory
              </Label>
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
                {editor.items.length === 0 && (
                  <li className="p-2 text-sm text-muted-foreground">
                    Nothing selected yet.
                  </li>
                )}
                {editor.items.map((item, index) => (
                  <li
                    key={item.libraryItemId}
                    className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm"
                  >
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                      <Checkbox
                        checked={item.isMandatory}
                        onCheckedChange={(checked) =>
                          setMandatory(item.libraryItemId, checked === true)
                        }
                      />
                      Mandatory
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Move down"
                      disabled={index === editor.items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${item.title}`}
                      onClick={() =>
                        toggleItem(
                          {
                            id: item.libraryItemId,
                            title: item.title,
                            category: item.category,
                          },
                          false
                        )
                      }
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || editor.items.length === 0}
            >
              {pending
                ? "Saving…"
                : editor.templateId
                  ? "Save changes"
                  : "Create template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
