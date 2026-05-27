import { Skeleton } from "@/components/ui/skeleton";

function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function PageHeaderSkeleton({
  descriptionWidth = "w-80",
  actionCount = 2,
}: {
  descriptionWidth?: string;
  actionCount?: number;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className={`h-4 max-w-full ${descriptionWidth}`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: actionCount }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-24" />
        ))}
      </div>
    </div>
  );
}

function TableSurfaceSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-4 gap-4 border-b px-4 py-3 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-16" />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid grid-cols-4 gap-4 px-4 py-4 md:grid-cols-6">
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-4 w-full max-w-28" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
    </div>
  );
}

function SectionTitleSkeleton({
  width = "w-44",
  metaWidth,
}: {
  width?: string;
  metaWidth?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <Skeleton className={`h-7 ${width}`} />
      {metaWidth ? <Skeleton className={`h-6 ${metaWidth}`} /> : null}
    </div>
  );
}

function ChartCardSkeleton({
  titleWidth = "w-40",
  descriptionWidth = "w-56",
  height = "h-72",
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  height?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="space-y-4">
        <Skeleton className={`h-5 ${titleWidth}`} />
        <Skeleton className={`h-4 max-w-full ${descriptionWidth}`} />
        <Skeleton className={`w-full ${height}`} />
      </div>
    </div>
  );
}

export function DashboardContentSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeaderSkeleton />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCardSkeleton />
        <ChartCardSkeleton titleWidth="w-32" descriptionWidth="w-48" />
      </div>

      <div className="space-y-3">
        <SectionTitleSkeleton />
        <TableSurfaceSkeleton />
      </div>
    </div>
  );
}

export function DashboardShellSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeaderSkeleton descriptionWidth="w-72" actionCount={1} />

      <div className="rounded-xl border bg-card p-5">
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ReportsContentSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeaderSkeleton descriptionWidth="w-96" actionCount={3} />

      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ChartCardSkeleton titleWidth="w-44" descriptionWidth="w-72" />
        <ChartCardSkeleton titleWidth="w-36" descriptionWidth="w-52" />
      </div>

      <div className="space-y-3">
        <SectionTitleSkeleton width="w-48" />
        <TableSurfaceSkeleton rows={5} />
      </div>
    </div>
  );
}

export function ErpWorkspaceShellSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeaderSkeleton descriptionWidth="w-80" actionCount={2} />
      <div className="space-y-3">
        <SectionTitleSkeleton width="w-40" />
        <TableSurfaceSkeleton rows={6} />
      </div>
    </div>
  );
}

export function ErpTablePageSkeleton({
  actionCount = 1,
  descriptionWidth = "w-72",
  titleWidth = "w-40",
  rows = 6,
}: {
  actionCount?: number;
  descriptionWidth?: string;
  titleWidth?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeaderSkeleton descriptionWidth={descriptionWidth} actionCount={actionCount} />
      <div className="space-y-3">
        <SectionTitleSkeleton width={titleWidth} />
        <TableSurfaceSkeleton rows={rows} />
      </div>
    </div>
  );
}

export function DocumentsPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeaderSkeleton descriptionWidth="w-80" actionCount={1} />
      <div className="space-y-3">
        <SectionTitleSkeleton width="w-36" />
        <div className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
          </div>
          <TableSurfaceSkeleton rows={5} />
        </div>
      </div>
    </div>
  );
}

export function WorkspacesContentSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-52" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamManagerSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-60 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-10 w-full md:w-80" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 md:w-80 md:flex-row">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RolesListSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-72 max-w-full" />
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
          <TableSurfaceSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}

export function RoleEditorSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-48 max-w-full" />
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, groupIndex) => (
              <div key={groupIndex} className="rounded-xl border p-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-56 max-w-full" />
                  </div>
                  {Array.from({ length: 4 }).map((__, itemIndex) => (
                    <div key={itemIndex} className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56 max-w-full" />
                      </div>
                      <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreateProjectSkeleton() {
  return (
    <div className="grid min-h-dvh bg-background xl:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden border-r bg-sidebar p-10 xl:flex xl:flex-col">
        <div className="my-auto space-y-6">
          <Skeleton className="h-5 w-40 bg-sidebar-accent" />
          <Skeleton className="h-14 w-full max-w-xl bg-sidebar-accent" />
          <Skeleton className="h-6 w-full max-w-2xl bg-sidebar-accent/80" />
        </div>
      </section>

      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-2xl rounded-3xl border bg-card p-6 shadow-sm md:p-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-10 w-64 max-w-full" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
              <div className="space-y-2 md:col-span-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
