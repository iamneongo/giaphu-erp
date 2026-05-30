import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createGiaPhuSchema, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import { projectScopedPath } from "@/lib/giaphu-erp/project-routes";

export const dynamic = "force-dynamic";

export default async function Page() {
  await createGiaPhuSchema();
  const projects = await getGiaPhuProjectList();

  if (!projects.length) {
    redirect("/create-project");
  }

  const cookieStore = await cookies();
  const activeProjectCode = cookieStore.get(ACTIVE_PROJECT_COOKIE_NAME)?.value;
  const activeProject = projects.find((project) => project.code === activeProjectCode) ?? projects[0];

  redirect(projectScopedPath(activeProject.code, "/overview"));
}
