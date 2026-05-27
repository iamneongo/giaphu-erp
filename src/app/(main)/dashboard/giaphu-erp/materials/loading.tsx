import { ErpTablePageSkeleton } from "../../_components/loading-skeletons";

export default function Loading() {
  return <ErpTablePageSkeleton actionCount={1} descriptionWidth="w-80" titleWidth="w-32" rows={7} />;
}
