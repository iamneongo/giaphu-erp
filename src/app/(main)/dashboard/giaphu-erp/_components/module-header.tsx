import type { LucideIcon } from "lucide-react";

export function ModuleHeader({
  title,
  description: _description,
  icon: _Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
    </div>
  );
}
