import { InteractiveGrid } from "@/app/auth/_components/interactive-grid";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="grid min-h-dvh bg-background xl:grid-cols-[1.1fr_0.9fr]">
        <section
          aria-hidden="true"
          className="relative hidden overflow-hidden border-r bg-sidebar p-10 text-sidebar-foreground xl:flex xl:flex-col"
        >
          <InteractiveGrid className="mask-[radial-gradient(560px_circle_at_center,white,transparent)] inset-0 h-full skew-y-6" />
        </section>

        <section className="flex items-center justify-center p-4 md:p-8 xl:p-12">
          <div className="w-full max-w-xl space-y-8">
            <div className="space-y-3 text-center xl:text-left">
              <Skeleton className="h-9 w-48" />
            </div>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {["code", "status", "name", "owner", "contact", "referrer", "note"].map((field, index) => (
                  <div key={field} className={index === 2 || index === 6 ? "space-y-2 md:col-span-2" : "space-y-2"}>
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-4 w-64 max-w-full" />
                <Skeleton className="h-11 w-44" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
