"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  CalendarDays,
  ClipboardList,
  UserCheck,
  Users,
  Menu,
  LogOut,
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

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  module: string;
}

const navItems: NavItem[] = [
  { href: "/admin/events", label: "活動管理", icon: CalendarDays, module: "events" },
  { href: "/admin/registrations", label: "報名管理", icon: ClipboardList, module: "registrations" },
  { href: "/admin/attendance", label: "出席管理", icon: UserCheck, module: "attendance" },
  { href: "/admin/users", label: "使用者管理", icon: Users, module: "users" },
];

const roleLabels: Record<string, string> = {
  ADMIN: "統籌者",
  STAFF_ADMIN: "行政同工",
  STAFF_GENERAL: "總務同工",
  STAFF_FINANCE: "財務同工",
  PASTOR: "傳道人",
  STAFF_MEDIA: "多媒體同工",
  TEAM_LEADER: "組長",
  MEMBER: "會員",
};

function SidebarNav({
  role,
  onNavigate,
}: {
  role?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<Record<string, { read: boolean; write: boolean }> | null>(null);

  useEffect(() => {
    if (role === "ADMIN") return;
    fetch("/api/role-permissions")
      .then((res) => res.json())
      .then((matrix) => {
        if (role && matrix[role]) {
          setPermissions(matrix[role]);
        }
      })
      .catch(() => {});
  }, [role]);

  const visibleItems = navItems.filter((item) => {
    if (role === "ADMIN") return true;
    if (!permissions) return false;
    return permissions[item.module]?.read ?? false;
  });

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
  const [sheetOpen, setSheetOpen] = useState(false);

  if (status === "loading") {
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

  const user = session.user;
  const userRole = user.role ?? "MEMBER";

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
          <SidebarNav role={userRole} />
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
                  role={userRole}
                  onNavigate={() => setSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden md:block" />

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{user.name ?? "使用者"}</span>
            <Badge variant="secondary">
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
