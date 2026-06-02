import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="flex min-h-dvh items-center justify-center bg-background p-4 md:p-8 xl:p-12">
        <section className="w-full">
          <div className="mx-auto w-full max-w-xl space-y-8">
            <div className="space-y-3 text-center">
              <Skeleton className="mx-auto h-9 w-48" />
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
