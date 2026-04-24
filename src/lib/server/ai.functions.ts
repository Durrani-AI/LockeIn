import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function aiKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("AI service is not configured.");
  return k;
}

async function callAI(body: Record<string, unknown>) {
  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", ...body }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    const t = await res.text();
    console.error("AI gateway error", res.status, t);
    throw new Error("AI request failed");
  }
  return res.json();
}

/* -------------------- 1. Extract PDF text -------------------- */

export const extractCvText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ cvId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cv, error: cvErr } = await supabase
      .from("cvs")
      .select("id, storage_path, user_id")
      .eq("id", data.cvId)
      .single();
    if (cvErr || !cv) throw new Error("CV not found");
    if (cv.user_id !== userId) throw new Error("Forbidden");

    const { data: file, error: dlErr } = await supabase.storage.from("cvs").download(cv.storage_path);
    if (dlErr || !file) throw new Error("Could not download CV file");

    const buffer = new Uint8Array(await file.arrayBuffer());
    const { extractText } = await import("unpdf");
    const { text } = await extractText(buffer, { mergePages: true });
    const fullText = Array.isArray(text) ? text.join("\n") : text;

    const cleaned = fullText.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    const { error: upErr } = await supabase
      .from("cvs")
      .update({ extracted_text: cleaned })
      .eq("id", cv.id);
    if (upErr) throw new Error("Could not save extracted text");

    return { text: cleaned, length: cleaned.length };
  });

/* -------------------- 2. Analyse CV vs JD -------------------- */

const matchSchema = {
  type: "object",
  properties: {
    fit_score: { type: "number", description: "0-100 overall fit" },
    summary: { type: "string", description: "1-2 sentence overall fit assessment" },
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string" },
          evidence: { type: "string", description: "What in the CV supports this" },
        },
        required: ["point", "evidence"],
        additionalProperties: false,
      },
    },
    gaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string" },
          how_to_address: { type: "string" },
        },
        required: ["point", "how_to_address"],
        additionalProperties: false,
      },
    },
    emphasise: {
      type: "array",
      items: { type: "string" },
      description: "3-6 things to emphasise in the cover letter",
    },
  },
  required: ["fit_score", "summary", "strengths", "gaps", "emphasise"],
  additionalProperties: false,
};

export const analyseMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      cvId: z.string().uuid(),
      jobDescription: z.string().min(20).max(20000),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cv, error } = await supabase
      .from("cvs")
      .select("user_id, extracted_text")
      .eq("id", data.cvId)
      .single();
    if (error || !cv) throw new Error("CV not found");
    if (cv.user_id !== userId) throw new Error("Forbidden");
    if (!cv.extracted_text) throw new Error("CV text not extracted yet");

    const result = await callAI({
      messages: [
        {
          role: "system",
          content:
            "You are a senior recruiter. Analyse how well a candidate's CV fits a job description. Be specific, not generic. Cite real evidence from the CV. Identify real gaps, not nitpicks.",
        },
        {
          role: "user",
          content: `CV:\n"""\n${cv.extracted_text.slice(0, 12000)}\n"""\n\nJOB DESCRIPTION:\n"""\n${data.jobDescription}\n"""`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_match",
            description: "Report the CV vs JD match analysis",
            parameters: matchSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_match" } },
    });

    const call = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("AI returned no analysis");
    const parsed = JSON.parse(call.function.arguments);
    return { analysis: parsed };
  });

/* -------------------- 3. Generate cover letter -------------------- */

export const generateCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      cvId: z.string().uuid(),
      jobTitle: z.string().min(1).max(200),
      company: z.string().min(1).max(200),
      jobDescription: z.string().min(20).max(20000),
      analysis: z.unknown().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: cv, error: cvErr }, { data: profile, error: profErr }, { data: userProfile }] =
      await Promise.all([
        supabase.from("cvs").select("user_id, extracted_text").eq("id", data.cvId).single(),
        supabase.from("communication_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      ]);

    if (cvErr || !cv) throw new Error("CV not found");
    if (cv.user_id !== userId) throw new Error("Forbidden");
    if (!cv.extracted_text) throw new Error("CV not parsed yet");
    if (profErr) throw new Error("Could not load communication profile");
    if (!profile) throw new Error("Please complete the communication style questionnaire first.");

    const scale = (v: number, low: string, high: string) => {
      if (v <= 2) return `Strongly ${low}`;
      if (v === 3) return `Balanced — slight lean to ${low}`;
      if (v === 4) return `Balanced — slight lean to ${high}`;
      return `Strongly ${high}`;
    };

    const voice = [
      `Directness: ${scale(profile.directness, "considered & nuanced", "direct & to-the-point")}`,
      `Formality: ${scale(profile.formality, "conversational", "formal & polished")}`,
      `Confidence: ${scale(profile.confidence, "humble & curious", "boldly confident")}`,
      `Detail: ${scale(profile.detail_level, "high-level & punchy", "specific & detailed")}`,
      `Warmth: ${scale(profile.warmth, "professional & reserved", "warm & personal")}`,
      `Energy: ${scale(profile.energy, "calm & measured", "energetic & enthusiastic")}`,
      profile.values_text ? `Values & themes: ${profile.values_text}` : null,
      profile.voice_summary ? `Voice notes: ${profile.voice_summary}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const candidateName = userProfile?.display_name || "the candidate";

    const system = `You are writing as ${candidateName}, applying to a job. Your job is to write a cover letter that sounds unmistakably like this person, not like an AI template.

STRICT RULES:
- Match the voice profile EXACTLY. If they said "direct", be direct. If "warm", be warm.
- No clichés. No "I am writing to express my interest". No "passionate". No "team player".
- Use specific evidence from the CV. Name companies, products, numbers, outcomes.
- Address the role's actual needs, not generic platitudes.
- 3-4 short paragraphs. ~250-320 words. Plain text only — no markdown, no headers.
- Open with a hook that's specific to the company or role, not the candidate.
- End with a clear, non-grovelling close.`;

    const user = `=== CANDIDATE CV ===
${cv.extracted_text.slice(0, 10000)}

=== ROLE ===
${data.jobTitle} at ${data.company}

=== JOB DESCRIPTION ===
${data.jobDescription}

=== VOICE PROFILE ===
${voice}

${data.analysis ? `=== EMPHASIS HINTS ===\n${JSON.stringify(data.analysis, null, 2)}\n` : ""}
Now write the cover letter. Plain text only.`;

    const result = await callAI({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = (result.choices?.[0]?.message?.content as string | undefined)?.trim();
    if (!content) throw new Error("AI returned no letter");

    const { data: saved, error: saveErr } = await supabase
      .from("cover_letters")
      .insert({
        user_id: userId,
        cv_id: data.cvId,
        job_title: data.jobTitle,
        company: data.company,
        job_description: data.jobDescription,
        content,
        match_analysis: (data.analysis ?? null) as never,
      })
      .select("id")
      .single();

    if (saveErr) {
      console.error("Save letter failed", saveErr);
      throw new Error("Could not save the letter");
    }

    return { id: saved.id, content };
  });
