"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ClipboardCheck, Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setLocaleAction } from "./actions";
import { APP_NAME } from "@/lib/config";

interface PortalChecklist {
  id: string;
  title: string;
  status: "sent" | "in_progress" | "completed";
  createdAt: string;
  projectName: string;
  totalItems: number;
  completedItems: number;
}

export function PortalDashboardView({
  viewerName,
  checklists,
  currentLocale,
}: {
  viewerName: string;
  checklists: PortalChecklist[];
  currentLocale: string;
}) {
  const t = useTranslations("Portal");
  const [pending, startTransition] = useTransition();

  function toggleLanguage() {
    const nextLocale = currentLocale === "en" ? "hi" : "en";
    startTransition(async () => {
      await setLocaleAction(nextLocale);
    });
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary text-primary-foreground p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold">{t("welcome", { name: viewerName, appName: APP_NAME })}</h2>
          <p className="text-xs opacity-80 mt-1">
            Indian construction liaison document requests.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={toggleLanguage}
          disabled={pending}
          className="w-fit"
        >
          <Languages className="size-4 mr-1.5" />
          {currentLocale === "en" ? "हिन्दी" : "English"}
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          {t("checklists")}
        </h3>

        {checklists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground">
              <ClipboardCheck className="size-12 text-muted-foreground/30 mb-4" />
              <p className="font-semibold">{t("noChecklists")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {checklists.map((c) => {
              const progress = c.totalItems > 0 ? (c.completedItems / c.totalItems) * 100 : 0;
              const isFinished = c.completedItems === c.totalItems;

              return (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          {c.projectName}
                        </span>
                        <CardTitle className="text-base mt-1.5">{c.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>
                          {isFinished
                            ? t("completedDocs")
                            : t("remainingDocs", { count: c.totalItems - c.completedItems })}
                        </span>
                        <span>
                          {c.completedItems}/{c.totalItems}
                        </span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>

                    <Link
                      href={`/portal/checklists/${c.id}`}
                      className={cn(buttonVariants({ variant: "default" }), "w-full")}
                    >
                      Open Checklist
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
