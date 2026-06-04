import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { createGiaPhuSchema, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import { decodeProjectRouteSegment, projectScopedPath } from "@/lib/giaphu-erp/project-routes";

export const dynamic = "force-dynamic";

export default async function Page() {
  await createGiaPhuSchema();
  const session = await auth();
  const projects = await getGiaPhuProjectList({ organizationId: session.orgId ?? "" });

  if (!projects.length) {
    redirect("/create-project");
  }

  const cookieStore = await cookies();
  const activeProjectCode = decodeProjectRouteSegment(cookieStore.get(ACTIVE_PROJECT_COOKIE_NAME)?.value ?? "");
  const activeProject = projects.find((project) => project.code === activeProjectCode) ?? projects[0];

  redirect(projectScopedPath(activeProject.id, "/overview"));
}
