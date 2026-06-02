import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { ProjectOnboarding } from "@/app/(main)/dashboard/giaphu-erp/_components/project-onboarding";
import { createGiaPhuSchema, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";
import { projectScopedPath } from "@/lib/giaphu-erp/project-routes";

export const metadata = {
  title: "Tạo công trình | Gia Phú ERP",
};
export const dynamic = "force-dynamic";

export default async function Page() {
  await createGiaPhuSchema();
  const session = await auth();
  const organizationId = session.orgId ?? "";
  const projects = await getGiaPhuProjectList({ organizationId });

  if (projects.length > 0) {
    redirect(projectScopedPath(projects[0].code, "/overview"));
  }

  return <ProjectOnboarding />;
}
