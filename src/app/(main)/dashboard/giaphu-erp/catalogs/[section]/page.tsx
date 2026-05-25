import { notFound } from "next/navigation";

import { CatalogsWorkspace } from "../../_components/catalogs-workspace";
import { getCatalogSectionBySlug } from "../../_lib/catalog-config";

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section: sectionSlug } = await params;
  const section = getCatalogSectionBySlug(sectionSlug);

  if (!section) {
    notFound();
  }

  return <CatalogsWorkspace kind={section.kind} />;
}
