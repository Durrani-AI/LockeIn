import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Bookmark, BookmarkCheck, Briefcase, MapPin, Calendar, ExternalLink,
  Loader2, Sparkles, Wand2, Copy, Download, AlertCircle, CheckCircle2, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { analyseCvForJob, generateCoverLetter } from "@/lib/server/ai.functions";

export const Route = createFileRoute("/_authenticated/app/jobs/$jobId")({
  component: JobDetailPage,
});

interface Job {
  id: string;
  company: string;
  role_title: string;
  category: string;
  job_type: string;
  location: string;
  deadline: string | null;
  short_summary: string;
  description: string;
  requirements: string | null;
  apply_url: string | null;
  salary: string | null;
}

interface CvAdvice {
  fit_score: number;
  summary: string;
  strengths: { point: string; evidence: string }[];
  gaps: { point: string; severity: string; how_to_address: string }[];
  edits: { location: string; current: string; suggested: string; why: string }[];
  keywords_to_add: string[];
}

const STATUSES = ["saved", "applying", "applied", "interviewing", "offer", "rejected"] as const;
type Status = typeof STATUSES[number];

const TONE_KEYS = [
  { key: "directness", label: "Directness", low: "Considered", high: "Direct" },
  { key: "formality", label: "Formality", low: "Conversational", high: "Formal" },
  { key: "confidence", label: "Confidence", low: "Humble", high: "Bold" },
  { key: "detail_level", label: "Detail", low: "Punchy", high: "Detailed" },
  { key: "warmth", label: "Warmth", low: "Reserved", high: "Warm" },
  { key: "energy", label: "Energy", low: "Calm", high: "Energetic" },
] as const;

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const { user } = useAuth();
  const analyse = useServerFn(analyseCvForJob);
  const generate = useServerFn(generateCoverLetter);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedRow, setSavedRow] = useState<{ id: string; status: Status } | null>(null);
  const [hasCv, setHasCv] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [profile, setProfile] = useState<Record<string, number> | null>(null);

  // CV advice
  const [analysing, setAnalysing] = useState(false);
  const [advice, setAdvice] = useState<CvAdvice | null>(null);

  // Cover letter
  const [showToneOverrides, setShowToneOverrides] = useState(false);
  const [toneOverrides, setToneOverrides] = useState<Record<string, number>>({});
  const [extraContext, setExtraContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: j }, { data: sj }, { count: cvCount }, { data: prof }, { data: lastAdvice }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", jobId).single(),
        supabase.from("saved_jobs").select("id, status").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
        supabase.from("cvs").select("id", { count: "exact", head: true }),
        supabase.from("communication_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("cv_advice").select("*").eq("user_id", user.id).eq("job_id", jobId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setJob(j as Job | null);
      setSavedRow(sj as { id: string; status: Status } | null);
      setHasCv((cvCount ?? 0) > 0);
      setHasProfile(!!prof);
      if (prof) {
        setProfile({
          directness: prof.directness, formality: prof.formality, confidence: prof.confidence,
          detail_level: prof.detail_level, warmth: prof.warmth, energy: prof.energy,
        });
        setToneOverrides({
          directness: prof.directness, formality: prof.formality, confidence: prof.confidence,
          detail_level: prof.detail_level, warmth: prof.warmth, energy: prof.energy,
        });
      }
      if (lastAdvice) {
        setAdvice({
          fit_score: lastAdvice.fit_score,
          summary: lastAdvice.summary,
          strengths: lastAdvice.strengths as never,
          gaps: lastAdvice.gaps as never,
          edits: lastAdvice.edits as never,
          keywords_to_add: lastAdvice.keywords_to_add as never,
        });
      }
      setLoading(false);
    })();
  }, [user, jobId]);

  const toggleSave = async () => {
    if (!user || !job) return;
    if (savedRow) {
      await supabase.from("saved_jobs").delete().eq("id", savedRow.id);
      setSavedRow(null);
      toast.success("Removed from saved");
    } else {
      const { data } = await supabase.from("saved_jobs")
        .insert({ user_id: user.id, job_id: job.id, status: "saved" })
        .select("id, status").single();
      if (data) setSavedRow(data as { id: string; status: Status });
      toast.success("Saved to your tracker");
    }
  };

  const setStatus = async (status: Status) => {
    if (!user || !job) return;
    if (savedRow) {
      await supabase.from("saved_jobs").update({ status }).eq("id", savedRow.id);
      setSavedRow({ ...savedRow, status });
    } else {
      const { data } = await supabase.from("saved_jobs")
        .insert({ user_id: user.id, job_id: job.id, status })
        .select("id, status").single();
      if (data) setSavedRow(data as { id: string; status: Status });
    }
    toast.success(`Status: ${status}`);
  };

  const runAdvice = async () => {
    if (!hasCv) { toast.error("Upload your CV first."); return; }
    setAnalysing(true);
    setAdvice(null);
    try {
      const { advice } = await analyse({ data: { jobId } });
      setAdvice(advice as CvAdvice);
      toast.success("CV advice ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalysing(false);
    }
  };

  const runGenerate = async () => {
    if (!hasCv || !hasProfile) { toast.error("Complete CV and voice profile first."); return; }
    setGenerating(true);
    setLetter(null);
    try {
      // only send overrides that differ from saved profile
      const overrides: Record<string, number> = {};
      if (profile) {
        for (const k of Object.keys(toneOverrides)) {
          if (toneOverrides[k] !== profile[k]) overrides[k] = toneOverrides[k];
        }
      }
      const { content } = await generate({
        data: {
          jobId,
          toneOverrides: Object.keys(overrides).length ? overrides : undefined,
          extraContext: extraContext.trim() || undefined,
        },
      });
      setLetter(content);
      toast.success("Cover letter ready — saved to Documents");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!job) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Job not found.</CardContent></Card>;
  }

  const setupOk = hasCv && hasProfile;

  return (
    <div className="space-y-6">
      <Link to="/app/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All jobs
      </Link>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="h-3 w-3" />{job.company}
              </div>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{job.role_title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                {job.deadline && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Deadline {new Date(job.deadline).toLocaleDateString()}</span>}
                <Badge variant="secondary" className="capitalize">{job.category}</Badge>
                <Badge variant="outline" className="capitalize">{job.job_type}</Badge>
                {job.salary && <Badge variant="outline">{job.salary}</Badge>}
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row">
              <Button variant={savedRow ? "secondary" : "default"} onClick={toggleSave}>
                {savedRow ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
                {savedRow ? "Saved" : "Save"}
              </Button>
              <Select value={savedRow?.status ?? undefined} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Set status" /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {job.apply_url && (
                <Button asChild variant="outline">
                  <a href={job.apply_url} target="_blank" rel="noreferrer">
                    Apply <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader><CardTitle className="text-base">About the role</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{job.description}</p>
          {job.requirements && (
            <div>
              <h3 className="font-display text-sm font-semibold">Requirements</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup nudge */}
      {!setupOk && (
        <Card className="border-warning/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Finish setup to use AI tools</CardTitle>
                <CardDescription>The CV and cover-letter tools need both files in place.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {!hasCv && <Button asChild><Link to="/app/cv">Upload CV</Link></Button>}
            {!hasProfile && <Button asChild variant={hasCv ? "default" : "outline"}><Link to="/app/voice">Build voice profile</Link></Button>}
          </CardContent>
        </Card>
      )}

      {/* AI: Tailor CV advice */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Tailor your CV for this role</CardTitle>
              <CardDescription>
                AI scans your CV against this job and tells you exactly what to change. You make the edits yourself in your CV file — we never rewrite it.
              </CardDescription>
            </div>
            <Button onClick={runAdvice} disabled={!hasCv || analysing}>
              {analysing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {advice ? "Re-analyse" : "Analyse my CV"}
            </Button>
          </div>
        </CardHeader>
        {advice && (
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 p-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Fit score</div>
                <p className="mt-1 text-sm">{advice.summary}</p>
              </div>
              <Badge variant={advice.fit_score >= 70 ? "default" : "secondary"} className="text-base">{advice.fit_score}/100</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-success">Strengths</h4>
                <ul className="space-y-2 text-sm">
                  {advice.strengths.map((s, i) => (
                    <li key={i} className="rounded-md border border-border bg-card p-3">
                      <div className="font-medium">{s.point}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{s.evidence}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-warning">Gaps</h4>
                <ul className="space-y-2 text-sm">
                  {advice.gaps.map((g, i) => (
                    <li key={i} className="rounded-md border border-border bg-card p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{g.point}</div>
                        <Badge variant="outline" className="text-[10px] capitalize">{g.severity}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{g.how_to_address}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Specific edits to make in your CV</h4>
              <ul className="space-y-3">
                {advice.edits.map((e, i) => (
                  <li key={i} className="rounded-lg border border-border bg-surface/40 p-4 text-sm">
                    <div className="text-xs font-mono text-muted-foreground">{e.location}</div>
                    {e.current && (
                      <div className="mt-2">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">Currently</span>
                        <p className="mt-1 rounded border border-border bg-background p-2 text-xs">{e.current}</p>
                      </div>
                    )}
                    <div className="mt-2">
                      <span className="text-xs uppercase tracking-wider text-success">Change to</span>
                      <p className="mt-1 rounded border border-success/30 bg-success/5 p-2 text-xs">{e.suggested}</p>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Why:</span> {e.why}</div>
                  </li>
                ))}
              </ul>
            </div>

            {advice.keywords_to_add.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Keywords missing from your CV</h4>
                <div className="flex flex-wrap gap-2">
                  {advice.keywords_to_add.map((k, i) => <Badge key={i} variant="outline">{k}</Badge>)}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Add these where they're truthful — e.g. in your skills section or as bullet points in relevant experience.</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* AI: Generate cover letter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Generate a tailored cover letter</CardTitle>
          <CardDescription>
            Uses your CV + your voice profile + this job. Tweak the tone for this role below if you want.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            onClick={() => setShowToneOverrides((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-surface/40 px-4 py-3 text-sm font-medium hover:bg-surface"
            disabled={!hasProfile}
          >
            <span>Tone overrides for this role (optional)</span>
            <ChevronDown className={"h-4 w-4 transition-transform " + (showToneOverrides ? "rotate-180" : "")} />
          </button>
          {showToneOverrides && hasProfile && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              {TONE_KEYS.map((t) => (
                <div key={t.key}>
                  <Label className="text-xs">{t.label}</Label>
                  <Slider
                    min={1} max={5} step={1}
                    value={[toneOverrides[t.key] ?? 3]}
                    onValueChange={(v) => setToneOverrides((o) => ({ ...o, [t.key]: v[0] }))}
                    className="mt-2"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{t.low}</span><span>{t.high}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label htmlFor="ctx">Anything specific to mention? (optional)</Label>
            <Textarea
              id="ctx" rows={3}
              placeholder="e.g. I attended your insight day in 2024. I want to emphasise my dissertation on options pricing."
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              className="mt-2"
            />
          </div>

          <Button onClick={runGenerate} disabled={!setupOk || generating} size="lg" className="w-full sm:w-auto">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate cover letter
          </Button>
        </CardContent>
      </Card>

      {letter && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Your cover letter</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(letter); toast.success("Copied"); }}>
                  <Copy className="mr-2 h-3.5 w-3.5" />Copy
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const blob = new Blob([letter], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `cover-letter-${job.company.replace(/[^\w]/g, "-").toLowerCase()}.txt`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="mr-2 h-3.5 w-3.5" />.txt
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <article className="whitespace-pre-wrap rounded-lg border border-border bg-surface-elevated p-6 leading-relaxed">{letter}</article>
            <p className="mt-3 text-xs text-muted-foreground">Saved in <Link to="/app/history" className="text-primary hover:underline">Documents</Link>.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
