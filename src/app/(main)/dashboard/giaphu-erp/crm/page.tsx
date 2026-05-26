import { redirect } from "next/navigation";

import { createGiaPhuSchema, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";

export default async function Page() {
  await createGiaPhuSchema();
  const projects = await getGiaPhuProjectList();

  if (!projects.length) {
    redirect("/create-project");
  }

  redirect("/dashboard/giaphu-erp/crm/projects");
}
