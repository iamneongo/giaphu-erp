import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/giaphu-erp(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtectedRoute(request) || pathname.startsWith("/api/giaphu-erp");

  if (protectedRoute) {
    await auth.protect();
  }

  const { userId, orgId } = await auth();
  const isOrganizationSetup = pathname === "/dashboard/workspaces";

  if (userId && protectedRoute && !orgId && !isOrganizationSetup) {
    return NextResponse.redirect(new URL("/dashboard/workspaces", request.url));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/giaphu-erp", "/api/giaphu-erp/:path*"],
};
