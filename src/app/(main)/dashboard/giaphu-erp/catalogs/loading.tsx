import { ErpTablePageSkeleton } from "../../_components/loading-skeletons";

export default function Loading() {
  return <ErpTablePageSkeleton actionCount={1} descriptionWidth="w-72" titleWidth="w-36" rows={8} />;
}
