"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  CalendarDays,
  Users,
  UsersRound,
  Menu,
  LogOut,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AdminPermissionsProvider } from "@/contexts/admin-permissions";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  module: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/admin/events", label: "活動管理", icon: CalendarDays, module: "events" },
  { href: "/admin/users", label: "使用者管理", icon: Users, module: "users", adminOnly: true },
  { href: "/admin/teams", label: "組別管理", icon: UsersRound, module: "teams" },
];

const roleLabels: Record<string, string> = {
  ADMIN: "統籌者",
  STAFF_ADMIN: "行政同工",
  STAFF_GENERAL: "總務同工",
  STAFF_FINANCE: "財務同工",
  PASTOR: "傳道人",
  STAFF_MEDIA: "多媒體同工",
  TEAM_LEADER: "組長",
  MEMBER: "一般會員",
};

type RolePermissions = Record<string, { read: boolean; write: boolean }>;

function useRolePermissions(role?: string) {
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [isAdmin, setIsAdmin] = useState(role === "ADMIN");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!role) {
      setLoaded(true);
      return;
    }
    fetch("/api/me/permissions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.isAdmin) {
          setIsAdmin(true);
        } else {
          setPermissions(data.permissions ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [role]);

  const eventSubModules = ["registrations", "attendance", "assignments", "budget"];

  const visibleItems = navItems.filter((item) => {
    if (isAdmin) return true;
    if (item.adminOnly) return false;
    if (!permissions) return false;
    if (item.module === "events") {
      // Show events nav if user has events:read OR any sub-module read
      return (
        permissions.events?.read ||
        eventSubModules.some((m) => permissions[m]?.read)
      );
    }
    return permissions[item.module]?.read ?? false;
  });

  return { isAdmin, permissions, loaded, visibleItems };
}

function SidebarNav({
  visibleItems,
  onNavigate,
}: {
  visibleItems: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const userRole = session?.user?.role ?? "MEMBER";
  const { isAdmin, permissions, loaded, visibleItems } = useRolePermissions(userRole);

  const pathname = usePathname();

  useEffect(() => {
    if (!loaded) return;
    if (status !== "authenticated") return;
    if (visibleItems.length === 0) {
      router.replace("/events");
      return;
    }
    // If the current path doesn't match any permitted module, redirect
    const isPermitted =
      pathname === "/admin" ||
      visibleItems.some((item) => pathname.startsWith(item.href));
    if (!isPermitted) {
      router.replace(visibleItems[0].href);
    }
  }, [loaded, status, visibleItems, pathname, router]);

  if (status === "loading" || !loaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">請先登入</p>
      </div>
    );
  }

  const isPermittedPath =
    pathname === "/admin" ||
    visibleItems.some((item) => pathname.startsWith(item.href));

  if (visibleItems.length === 0 || !isPermittedPath) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">重新導向中...</p>
      </div>
    );
  }

  const user = session.user;

  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/admin/events" className="text-lg font-semibold">
            教會活動管理
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SidebarNav visibleItems={visibleItems} />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          {/* Mobile menu button */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
                <span className="sr-only">開啟選單</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle>教會活動管理</SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <SidebarNav
                  visibleItems={visibleItems}
                  onNavigate={() => setSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden md:block" />

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <Link
              href="/events"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="size-4" />
              <span className="hidden sm:inline">回到前台</span>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm font-medium truncate max-w-[80px] sm:max-w-none">{user.name ?? "使用者"}</span>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {roleLabels[userRole] ?? userRole}
            </Badge>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">登出</span>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <AdminPermissionsProvider isAdmin={isAdmin} permissions={permissions}>
            {children}
          </AdminPermissionsProvider>
        </main>
      </div>
    </div>
  );
}
