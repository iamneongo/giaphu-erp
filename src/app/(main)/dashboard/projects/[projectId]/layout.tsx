import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { createGiaPhuSchema, getGiaPhuDashboardData, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";
import { isProjectPinUnlocked, PROJECT_PIN_UNLOCK_COOKIE_NAME } from "@/lib/giaphu-erp/project-pin";
import { decodeProjectRouteSegment } from "@/lib/giaphu-erp/project-routes";

import { ProjectPinGate } from "../../giaphu-erp/_components/project-pin-unlock";
import { GiaPhuErpProvider } from "../../giaphu-erp/_hooks/use-giaphu-erp";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}>) {
  await createGiaPhuSchema();
  const session = await auth();
  const cookieStore = await cookies();
  const { projectId } = await params;
  const decodedProjectId = decodeProjectRouteSegment(projectId);
  const projects = await getGiaPhuProjectList({ organizationId: session.orgId ?? "" });

  if (!projects.length) {
    redirect("/create-project");
  }

  const activeProject =
    projects.find(
      (project) =>
        project.id === decodedProjectId || project.code === decodedProjectId || project.name === decodedProjectId,
    ) ?? projects[0];

  if (!isProjectPinUnlocked(activeProject, cookieStore.get(PROJECT_PIN_UNLOCK_COOKIE_NAME)?.value ?? "")) {
    return <ProjectPinGate project={activeProject} />;
  }

  const data = await getGiaPhuDashboardData({
    organizationId: session.orgId ?? "",
    activeProjectCode: activeProject.code,
  });

  return <GiaPhuErpProvider initialData={data}>{children}</GiaPhuErpProvider>;
}
