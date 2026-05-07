import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDUSTRY_DEFINITIONS, INDUSTRY_ORDER } from "@/lib/jobs/industry-taxonomy";

export const Route = createFileRoute("/_authenticated/app/jobs")({
  component: JobsIndustrySelectorPage,
});

function JobsIndustrySelectorPage() {
  const location = useLocation();
  if (location.pathname !== "/app/jobs" && location.pathname.startsWith("/app/jobs/")) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card px-6 py-7 shadow-soft sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Browse roles by industry
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Choose which industry you want to search first.
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
          This page is only for choosing the industry. Once you pick one, you will be taken to a separate listing page that shows only jobs, internships, and placements for that industry.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {INDUSTRY_ORDER.map((industry) => {
          const definition = INDUSTRY_DEFINITIONS[industry];
          return (
          <Link
            key={industry}
            to="/app/jobs/industry/$industry"
            params={{ industry }}
            className={cn(
              "group rounded-3xl border p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-soft",
              definition.accentClass,
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                  {definition.label}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{definition.description}</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{definition.note}</p>
            <div className="mt-5 flex items-center justify-between text-xs font-medium text-foreground">
              <span>Open {definition.label.toLowerCase()} listings</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
