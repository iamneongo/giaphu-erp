import { cookies } from "next/headers";
import Link from "next/link";

import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Lock } from "lucide-react";

import { getEffectiveErpPermissions, getFirstAccessibleDashboardHref } from "@/lib/clerk/erp-rbac";
import { createGiaPhuSchema, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import { decodeProjectRouteSegment } from "@/lib/giaphu-erp/project-routes";

export const dynamic = "force-dynamic";

async function getReturnHref() {
  const session = await auth();

  if (!session.userId) {
    return "/dashboard";
  }

  if (!session.orgId) {
    return "/dashboard/workspaces";
  }

  await createGiaPhuSchema();

  const [permissionKeys, projects, cookieStore] = await Promise.all([
    getEffectiveErpPermissions(session),
    getGiaPhuProjectList({ organizationId: session.orgId }),
    cookies(),
  ]);
  const activeProjectCode = decodeProjectRouteSegment(cookieStore.get(ACTIVE_PROJECT_COOKIE_NAME)?.value ?? "");
  const activeProject =
    projects.find(
      (project) =>
        project.id === activeProjectCode || project.code === activeProjectCode || project.name === activeProjectCode,
    ) ?? projects[0];

  const returnHref = getFirstAccessibleDashboardHref(session, { projectRouteId: activeProject?.id, permissionKeys });

  if (!activeProject && returnHref.startsWith("/dashboard/giaphu-erp")) {
    return "/create-project";
  }

  return returnHref;
}

export default async function Page() {
  const returnHref = await getReturnHref();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md text-center">
        <Lock className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 font-bold text-3xl tracking-tight sm:text-4xl">Bạn chưa có quyền truy cập</h1>
        <p className="mt-4 text-muted-foreground">
          Tài khoản của bạn chưa được cấp quyền để xem nội dung này. Vui lòng liên hệ quản trị viên nếu bạn cần truy cập
          chức năng này.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link
            href={returnHref}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-xs transition-colors hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
            prefetch={false}
          >
            Mở trang được cấp quyền
          </Link>
          <SignOutButton redirectUrl="/auth/sign-in">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 font-medium text-foreground text-sm shadow-xs transition-colors hover:bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Đăng xuất
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
