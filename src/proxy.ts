import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/giaphu-erp(.*)", "/api/clerk-rbac(.*)"]);
const isHardProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/giaphu-erp(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtectedRoute(request);
  const hardProtectedRoute = isHardProtectedRoute(request) || pathname.startsWith("/api/giaphu-erp");

  if (hardProtectedRoute) {
    await auth.protect();
  }

  if (protectedRoute) {
    await auth();
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/giaphu-erp", "/api/giaphu-erp/:path*", "/api/clerk-rbac", "/api/clerk-rbac/:path*"],
};
