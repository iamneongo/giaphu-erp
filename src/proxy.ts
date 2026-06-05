import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import { legacyErpPathForProject } from "@/lib/giaphu-erp/project-routes";
import { getAppOrigin } from "@/lib/site-url";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/create-project(.*)",
  "/api/giaphu-erp(.*)",
  "/api/clerk-rbac(.*)",
]);
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
const isCreateProjectRoute = createRouteMatcher(["/create-project(.*)"]);
const isOrganizationSetupRoute = createRouteMatcher(["/dashboard/workspaces(.*)", "/dashboard/profile(.*)"]);
const isApiRoute = createRouteMatcher(["/api/giaphu-erp(.*)"]);

function buildRedirectUrl(origin: string, request: Request) {
  try {
    const url = new URL(request.url);
    return `${origin}${decodeURI(url.pathname)}${url.search}`;
  } catch {
    const url = new URL(request.url);
    return `${origin}${url.pathname}${url.search}`;
  }
}

export default clerkMiddleware(async (auth, request) => {
  const protectedRoute = isProtectedRoute(request);
  if (!protectedRoute) {
    return;
  }

  const session = await auth();
  const { isAuthenticated, orgId } = session;

  if (!isAuthenticated && (isDashboardRoute(request) || isCreateProjectRoute(request))) {
    const origin = getAppOrigin(request.headers, request.url);
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", buildRedirectUrl(origin, request));
    return NextResponse.redirect(signInUrl);
  }

  if (!isAuthenticated && isApiRoute(request)) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  if (
    isAuthenticated &&
    !orgId &&
    ((isDashboardRoute(request) && !isOrganizationSetupRoute(request)) || isCreateProjectRoute(request))
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard/workspaces";
    redirectUrl.search = "";

    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthenticated && !orgId && isApiRoute(request)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Vui lòng chọn tổ chức được mời hoặc tạo tổ chức mới trước khi dùng ERP.",
      },
      { status: 403 },
    );
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
    "/create-project/:path*",
    "/create-project",
    "/api/giaphu-erp",
    "/api/giaphu-erp/:path*",
    "/api/clerk-rbac",
    "/api/clerk-rbac/:path*",
  ],
};
