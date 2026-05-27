import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", request.url);
    return NextResponse.redirect(signInUrl);
  }

  if (!isAuthenticated && isApiRoute(request)) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/giaphu-erp", "/api/giaphu-erp/:path*", "/api/clerk-rbac", "/api/clerk-rbac/:path*"],
};
