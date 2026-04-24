import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Copy, Download, Wand2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { analyseMatch, generateCoverLetter } from "@/lib/server/ai.functions";

export const Route = createFileRoute("/_authenticated/app/generate")({
  component: GeneratePage,
});

interface MatchAnalysis {
  fit_score: number;
  summary: string;
  strengths: { point: string; evidence: string }[];
  gaps: { point: string; how_to_address: string }[];
  emphasise: string[];
}

function GeneratePage() {
  const { user } = useAuth();
  const analyse = useServerFn(analyseMatch);
  const generate = useServerFn(generateCoverLetter);

  const [cvId, setCvId] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [checkLoading, setCheckLoading] = useState(true);

  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");

  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: cv }, { data: prof }] = await Promise.all([
        supabase.from("cvs").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("communication_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      setCvId(cv?.id ?? null);
      setHasProfile(!!prof);
      setCheckLoading(false);
    })();
  }, [user]);

  const canRun = cvId && hasProfile && jobTitle.trim() && company.trim() && jd.trim().length > 50;

  const runAnalysis = async () => {
    if (!cvId) return;
    setAnalysing(true);
    setAnalysis(null);
    try {
      const { analysis } = await analyse({ data: { cvId, jobDescription: jd } });
      setAnalysis(analysis as MatchAnalysis);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalysing(false);
    }
  };

  const runGenerate = async () => {
    if (!cvId) return;
    setGenerating(true);
    setLetter(null);
    try {
      const { content } = await generate({
        data: {
          cvId,
          jobTitle,
          company,
          jobDescription: jd,
          analysis: analysis ?? undefined,
        },
      });
      setLetter(content);
      toast.success("Letter ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    toast.success("Copied to clipboard");
  };

  const download = () => {
    if (!letter) return;
    const blob = new Blob([letter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${company.replace(/[^\w]/g, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (checkLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!cvId || !hasProfile) {
    return (
      <Card className="border-warning/40">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Finish setup first</CardTitle>
              <CardDescription>You need a CV and a voice profile before generating.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-2">
          {!cvId && <Button asChild><Link to="/app/cv">Upload CV</Link></Button>}
          {!hasProfile && <Button asChild variant={cvId ? "default" : "outline"}><Link to="/app/voice">Build voice profile</Link></Button>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Generate cover letter</h1>
        <p className="mt-1 text-muted-foreground">Paste a role. Optionally analyse fit. Generate.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>The role</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="title">Job title</Label>
              <Input id="title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Senior Frontend Engineer" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Linear" className="mt-2" />
            </div>
          </div>
          <div>
            <Label htmlFor="jd">Job description</Label>
            <Textarea
              id="jd"
              rows={10}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              className="mt-2 font-mono text-xs"
            />
            <div className="mt-1 text-xs text-muted-foreground">{jd.length} characters</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={runAnalysis} disabled={!canRun || analysing}>
          {analysing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Analyse match
        </Button>
        <Button onClick={runGenerate} disabled={!canRun || generating} className="ml-auto">
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate cover letter
        </Button>
      </div>

      {analysis && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Match analysis</CardTitle>
              <Badge variant={analysis.fit_score >= 70 ? "default" : "secondary"} className="text-base">
                {analysis.fit_score}/100
              </Badge>
            </div>
            <CardDescription>{analysis.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-success">Strengths</h4>
              <ul className="space-y-2 text-sm">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="rounded-md border border-border bg-surface/40 p-3">
                    <div className="font-medium">{s.point}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{s.evidence}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-warning">Gaps</h4>
              <ul className="space-y-2 text-sm">
                {analysis.gaps.map((g, i) => (
                  <li key={i} className="rounded-md border border-border bg-surface/40 p-3">
                    <div className="font-medium">{g.point}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{g.how_to_address}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2">
              <h4 className="mb-2 text-sm font-semibold">Emphasise in your letter</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.emphasise.map((e, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{e}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {letter && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your cover letter</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-2 h-3.5 w-3.5" />Copy</Button>
                <Button size="sm" variant="outline" onClick={download}><Download className="mr-2 h-3.5 w-3.5" />.txt</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <article className="whitespace-pre-wrap rounded-lg border border-border bg-surface-elevated p-6 leading-relaxed">
              {letter}
            </article>
            <p className="mt-3 text-xs text-muted-foreground">Saved to your history.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
