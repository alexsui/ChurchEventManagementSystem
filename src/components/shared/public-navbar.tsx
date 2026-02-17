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
    <header className="sticky top-0 z-50 bg-warm-cream/90 backdrop-blur-md border-b border-warm-sand">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/events" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-warm-green rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
            </svg>
          </div>
          <span className="font-display text-xl font-bold text-warm-dark tracking-tight">
            教會活動
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden sm:flex items-center gap-1">
          <NavLink href="/events" active={pathname === "/events"}>
            活動列表
          </NavLink>
          {isLoggedIn && (
            <NavLink
              href="/my/registrations"
              active={pathname === "/my/registrations"}
            >
              我的報名
            </NavLink>
          )}
          {hasAdminAccess && (
            <NavLink
              href="/admin/events"
              active={pathname.startsWith("/admin")}
            >
              管理後台
            </NavLink>
          )}
        </nav>

        {/* Auth */}
        <div>
          {isLoggedIn ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/events" })}
              className="text-warm-dark/70 hover:text-warm-dark hover:bg-warm-sand/60 rounded-full px-4 font-medium"
            >
              登出
            </Button>
          ) : (
            <Button
              size="sm"
              asChild
              className="bg-warm-green hover:bg-warm-green/90 text-white rounded-full px-5 font-display font-semibold shadow-sm hover:shadow-md transition-all"
            >
              <Link href="/login">登入</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2 rounded-full text-sm font-semibold transition-all",
        active
          ? "bg-warm-dark text-white shadow-sm"
          : "text-warm-dark/60 hover:text-warm-dark hover:bg-warm-sand/60"
      )}
    >
      {children}
    </Link>
  );
}
