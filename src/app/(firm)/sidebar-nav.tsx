"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Library,
  ListChecks,
  UserCog,
  Search,
  Trash,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/library", label: "Library", icon: Library },
  { href: "/templates", label: "Templates", icon: ListChecks },
  { href: "/search", label: "Search", icon: Search },
  { href: "/trash", label: "Trash", icon: Trash },
  { href: "/staff", label: "Staff", icon: UserCog, adminOnly: true },
];

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
