"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PublicNavbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

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
