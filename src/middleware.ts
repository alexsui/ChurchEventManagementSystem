import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Redirect incomplete profiles to /complete-profile
  if (
    req.auth?.user &&
    req.auth.user.profileCompleted === false &&
    pathname !== "/complete-profile" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    pathname !== "/login"
  ) {
    const completeUrl = new URL("/complete-profile", req.url);
    completeUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(completeUrl);
  }

  if (pathname.startsWith("/admin")) {
    if (!req.auth) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Block inactive users from accessing admin pages
    if (req.auth.user?.isActive === false) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/events/:path*", "/my/:path*", "/complete-profile"],
};
