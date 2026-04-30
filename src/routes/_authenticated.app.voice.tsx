import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { sanitizePlainText } from "@/lib/security/sanitize";

export const Route = createFileRoute("/_authenticated/app/voice")({
  component: VoicePage,
});

const QUESTIONS = [
  {
    key: "directness" as const,
    title: "Directness",
    prompt: "When you communicate, you tend to be…",
    low: "Considered & nuanced",
    high: "Direct & to-the-point",
  },
  {
    key: "formality" as const,
    title: "Formality",
    prompt: "Your natural tone is…",
    low: "Conversational",
    high: "Formal & polished",
  },
  {
    key: "confidence" as const,
    title: "Confidence",
    prompt: "When talking about yourself, you sound…",
    low: "Humble & curious",
    high: "Boldly confident",
  },
  {
    key: "detail_level" as const,
    title: "Detail level",
    prompt: "You prefer to be…",
    low: "High-level & punchy",
    high: "Specific & detailed",
  },
  {
    key: "warmth" as const,
    title: "Warmth",
    prompt: "Your default register is…",
    low: "Professional & reserved",
    high: "Warm & personal",
  },
  {
    key: "energy" as const,
    title: "Energy",
    prompt: "Your writing tends to be…",
    low: "Calm & measured",
    high: "Energetic & enthusiastic",
  },
];

type Answers = Record<typeof QUESTIONS[number]["key"], number>;

function VoicePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [answers, setAnswers] = useState<Answers>({
    directness: 3,
    formality: 3,
    confidence: 3,
    detail_level: 3,
    warmth: 3,
    energy: 3,
  });
  const [valuesText, setValuesText] = useState("");
  const [voiceSummary, setVoiceSummary] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("communication_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setHasProfile(true);
        setAnswers({
          directness: data.directness,
          formality: data.formality,
          confidence: data.confidence,
          detail_level: data.detail_level,
          warmth: data.warmth,
          energy: data.energy,
        });
        setValuesText(data.values_text ?? "");
        setVoiceSummary(data.voice_summary ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const safeValuesText = sanitizePlainText(valuesText, 2000);
    const safeVoiceSummary = sanitizePlainText(voiceSummary, 2000);
    const payload = {
      user_id: user.id,
      ...answers,
      values_text: safeValuesText || null,
      voice_summary: safeVoiceSummary || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("communication_profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Voice profile saved");
    setHasProfile(true);
    if (!hasProfile) navigate({ to: "/app/jobs" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Voice profile</h1>
        <p className="mt-1 text-muted-foreground">
          Six sliders that teach LockedIn how you communicate.
          {hasProfile && (
            <span className="ml-2 inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-8 pt-6">
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <div className="mb-1 flex items-baseline justify-between gap-4">
                <Label className="font-display text-base font-semibold">{q.title}</Label>
                <span className="text-xs text-muted-foreground">{q.prompt}</span>
              </div>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[answers[q.key]]}
                onValueChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v[0] }))}
                className="mt-3"
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{q.low}</span>
                <span>{q.high}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">A bit more about you (optional)</CardTitle>
          <CardDescription>Free-text notes give the model extra colour.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="values">Values, themes, or things you care about</Label>
            <Textarea
              id="values"
              rows={3}
              placeholder="e.g. craft, shipping fast, learning in public, calm collaboration"
              value={valuesText}
              onChange={(e) => setValuesText(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="voice">Anything specific about your voice</Label>
            <Textarea
              id="voice"
              rows={3}
              placeholder="e.g. I like short sentences. I avoid 'passionate'. I prefer specifics over abstractions."
              value={voiceSummary}
              onChange={(e) => setVoiceSummary(e.target.value)}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : hasProfile ? "Update profile" : "Save & continue"}
        </Button>
      </div>
    </div>
  );
}
