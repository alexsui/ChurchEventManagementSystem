"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PublicNavbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setHasAdminAccess(false);
      return;
    }
    fetch("/api/me/permissions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          setHasAdminAccess(false);
          return;
        }
        if (data.isAdmin) {
          setHasAdminAccess(true);
          return;
        }
        const perms = data.permissions ?? {};
        const hasAny = Object.values(perms).some(
          (mod) => (mod as { read: boolean }).read
        );
        setHasAdminAccess(hasAny);
      })
      .catch(() => setHasAdminAccess(false));
  }, [isLoggedIn]);

  return (
    <header className="border-b bg-white">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <nav className="flex items-center gap-4">
          <Link
            href="/events"
            className={cn(
              "text-sm font-medium transition-colors hover:text-foreground",
              pathname === "/events"
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            活動列表
          </Link>
          {isLoggedIn && (
            <Link
              href="/my/registrations"
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname === "/my/registrations"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              我的報名紀錄
            </Link>
          )}
          {hasAdminAccess && (
            <Link
              href="/admin/events"
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname.startsWith("/admin")
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              管理後台
            </Link>
          )}
        </nav>

        <div>
          {isLoggedIn ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/events" })}
            >
              登出
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">登入</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
