import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { createGiaPhuSchema, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  await createGiaPhuSchema();
  const session = await auth();
  const projects = await getGiaPhuProjectList({ organizationId: session.orgId ?? "" });

  if (!projects.length) {
    redirect("/create-project");
  }

  redirect("/dashboard/giaphu-erp/crm/projects");
}
