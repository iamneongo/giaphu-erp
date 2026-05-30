import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import { getProjectRouteInfo, legacyErpPathForProject } from "@/lib/giaphu-erp/project-routes";
import { getAppOrigin } from "@/lib/site-url";

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
    const origin = getAppOrigin(request.headers, request.url);
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (!isAuthenticated && isApiRoute(request)) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const projectRoute = getProjectRouteInfo(request.nextUrl.pathname);
  if (projectRoute) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = projectRoute.legacyPathname;

    const response = NextResponse.rewrite(rewriteUrl);
    response.cookies.set(ACTIVE_PROJECT_COOKIE_NAME, projectRoute.projectCode, {
      maxAge: 31_536_000,
      path: "/",
      sameSite: "lax",
    });

    return response;
  }

  const activeProjectCode = request.cookies.get(ACTIVE_PROJECT_COOKIE_NAME)?.value;
  if (activeProjectCode && request.nextUrl.pathname.startsWith("/dashboard/giaphu-erp")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = legacyErpPathForProject(request.nextUrl.pathname, activeProjectCode);

    return NextResponse.redirect(redirectUrl);
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
