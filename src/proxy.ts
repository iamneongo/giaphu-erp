import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/giaphu-erp(.*)", "/api/clerk-rbac(.*)"]);
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
const isApiRoute = createRouteMatcher(["/api/giaphu-erp(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const protectedRoute = isProtectedRoute(request);
  if (!protectedRoute) {
    return;
  }

  const { isAuthenticated } = await auth();

  if (!isAuthenticated && isDashboardRoute(request)) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = request.headers.get("host");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const origin =
      siteUrl && siteUrl.length > 0
        ? siteUrl
        : forwardedHost || host
          ? `${forwardedProto ?? "http"}://${forwardedHost ?? host}`
          : request.nextUrl.origin;
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (!isAuthenticated && isApiRoute(request)) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/giaphu-erp",
    "/api/giaphu-erp/:path*",
    "/api/clerk-rbac",
    "/api/clerk-rbac/:path*",
  ],
};
