import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, Target, PenLine, Check, Bookmark, TrendingUp, FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tailor — Internship & Graduate Application Tracker" },
      {
        name: "description",
        content:
          "Track internships, vacation schemes, and graduate roles in finance, tech, and law. AI tailors your CV and cover letter to every job.",
      },
      { property: "og:title", content: "Tailor — Internship & Graduate Application Tracker" },
      {
        property: "og:description",
        content:
          "Browse curated internships and graduate roles. Save jobs, track status, and tailor every application with AI.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.4] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <div className="absolute inset-0 bg-radial-fade" />

        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-elevated px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              For students hunting internships & grad roles
            </div>

            <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-foreground text-balance sm:text-6xl md:text-7xl">
              Track every application. <span className="text-primary">Tailor every word.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
              Browse curated internships and graduate schemes in finance, tech, and law.
              Save the ones that matter, track your progress, and let AI tailor your CV
              and cover letter to each role — using the actual job description.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/auth">
                  Browse jobs <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <a href="#how-it-works">How it works</a>
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">Free during beta · No credit card required</p>
          </div>

          {/* Visual mock */}
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="relative rounded-2xl border border-border-strong bg-surface-elevated p-2 shadow-soft">
              <div className="grid gap-2 rounded-xl bg-surface p-6 md:grid-cols-3">
                {[
                  { label: "Goldman Sachs", text: "Summer Analyst — Investment Banking", tone: "Applying" },
                  { label: "Linklaters", text: "Vacation Scheme — Corporate Law", tone: "Interviewing" },
                  { label: "Stripe", text: "Software Engineering Intern", tone: "Saved" },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg border border-border bg-card p-4 text-left">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </div>
                    <p className="mt-2 text-sm text-foreground">{c.text}</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {c.tone}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 pt-4 pb-2 text-center text-xs text-muted-foreground">
                ↓ Each role gets its own tailored CV & cover letter ↓
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-semibold tracking-tight">
              From job listing to submitted application.
            </h2>
            <p className="mt-4 text-muted-foreground">
              One workspace for finding roles, tracking deadlines, and crafting
              applications that don't sound like everyone else's.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Briefcase,
                step: "01",
                title: "Browse curated roles",
                body: "Hand-picked internships, vacation schemes, and graduate programmes across finance, tech, law, and consulting — with deadlines you won't miss.",
              },
              {
                icon: Bookmark,
                step: "02",
                title: "Save & track",
                body: "Bookmark roles, set application status (Saved → Applying → Interviewing → Offer), and keep notes against each one.",
              },
              {
                icon: PenLine,
                step: "03",
                title: "Tailor with AI",
                body: "From any job page: generate a cover letter or get CV edit suggestions tied to that exact JD — using your saved voice profile.",
              },
            ].map((f) => (
              <div
                key={f.step}
                className="group relative rounded-2xl border border-border bg-card p-8 transition-all hover:border-border-strong hover:shadow-soft"
              >
                <div className="text-xs font-mono text-muted-foreground">{f.step}</div>
                <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="grid gap-12 md:grid-cols-2 md:gap-20">
            <div>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-balance">
                Built for the spreadsheet you've been avoiding.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Most students juggle deadlines in Notion, CVs in Drive, and cover letters in
                a chaotic Word folder. Tailor brings the listing, the tracker, and the AI
                writing into one place — every document tied to the role it was written for.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Curated listings across finance, tech, law & graduate schemes",
                "Application status tracking with deadlines & notes",
                "AI cover letters & CV suggestions tied to each specific role",
                "Saved voice profile so every letter sounds like you",
                "Re-open any past document linked to the original job",
              ].map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-foreground">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Categories strip */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Categories we cover
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {["Finance", "Technology", "Law", "Consulting", "Graduate Schemes", "Engineering"].map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border-strong bg-surface-elevated px-4 py-2 text-sm font-medium text-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h2 className="mt-6 font-display text-4xl font-semibold tracking-tight text-balance">
            Apply to ten roles in the time it used to take to tailor one.
          </h2>
          <Button asChild size="lg" className="mt-8 h-12 px-6 text-base">
            <Link to="/auth">
              Get started free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        Built with care · Tailor
      </footer>
    </div>
  );
}
