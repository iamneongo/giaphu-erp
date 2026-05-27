import { ErpTablePageSkeleton } from "../../_components/loading-skeletons";

export default function Loading() {
  return <ErpTablePageSkeleton actionCount={3} descriptionWidth="w-96" titleWidth="w-40" rows={7} />;
}
