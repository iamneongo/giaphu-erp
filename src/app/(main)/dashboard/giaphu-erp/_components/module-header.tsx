import type { LucideIcon } from "lucide-react";

import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModuleHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Icon className="size-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {actions ? <CardAction className="flex flex-wrap gap-2">{actions}</CardAction> : null}
      </CardHeader>
    </Card>
  );
}
