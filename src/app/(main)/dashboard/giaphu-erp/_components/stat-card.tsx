import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={tone}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
