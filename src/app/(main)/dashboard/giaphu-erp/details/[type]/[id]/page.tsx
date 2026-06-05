import { DetailPageContent } from "../../../_components/detail-page-content";

export default async function DetailPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;

  return <DetailPageContent type={type} id={id} />;
}
