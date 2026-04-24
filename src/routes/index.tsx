import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Brain, PenLine, Check } from "lucide-react";

export const Route = createFileRoute("/")({
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
              Your personal application assistant
            </div>

            <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-foreground text-balance sm:text-6xl md:text-7xl">
              Cover letters that actually <span className="text-primary">sound like you</span>.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
              Upload your CV once. Paste a job description. Tailor reads both, understands your
              communication style, and writes a cover letter in your voice — not a generic AI template.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/auth">
                  Start tailoring <ArrowRight className="ml-2 h-4 w-4" />
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
                  { label: "CV", text: "5 years React. Shipped 12 products. Led team of 4.", tone: "primary" },
                  { label: "Role", text: "Senior Frontend at Linear — needs DX obsession + craft.", tone: "muted" },
                  { label: "You", text: "Direct. Considered. Conversational. Quietly confident.", tone: "success" },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg border border-border bg-card p-4 text-left">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </div>
                    <p className="mt-2 text-sm text-foreground">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="px-6 pt-4 pb-2 text-center text-xs text-muted-foreground">
                ↓ Tailor synthesises all three into one letter ↓
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
              Three layers. One letter.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Most cover letter tools use only a job description. Tailor uses three signals to
              write something that's actually yours.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: FileText,
                step: "01",
                title: "CV + JD analysis",
                body: "Upload your CV once. Paste any job description. We surface the strongest matches and the gaps worth addressing.",
              },
              {
                icon: Brain,
                step: "02",
                title: "Communication profile",
                body: "A short one-time questionnaire. Direct or detailed? Confident or considered? Stored once, used forever.",
              },
              {
                icon: PenLine,
                step: "03",
                title: "Tailored letter",
                body: "Your CV + the role + your voice → one cover letter that reads like you wrote it on a focused afternoon.",
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
                Not another generic cover letter generator.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Recruiters can spot AI-generated letters in three lines. Tailor's whole point is
                that the output sounds like a specific human — you, on a good day.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Your communication profile is the secret ingredient",
                "Match analysis tells you what to emphasise before writing",
                "Every letter is saved — re-use, edit, iterate",
                "Built for people who apply to lots of roles, fast",
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

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-balance">
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
