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

/* -------------------- Extract PDF text (kept) -------------------- */

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

/* -------------------- CV Tailoring Advice for a specific job -------------------- */

const adviceSchema = {
  type: "object",
  properties: {
    fit_score: { type: "number", description: "0-100 overall fit between CV and job" },
    summary: { type: "string", description: "2-3 sentence honest assessment of fit" },
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "Strength relative to this role" },
          evidence: { type: "string", description: "Quote/reference what in the CV proves it" },
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
          point: { type: "string", description: "Specific gap vs. the job description" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          how_to_address: { type: "string", description: "What the candidate could do (course, project, framing) — not advice for the AI to act on" },
        },
        required: ["point", "severity", "how_to_address"],
        additionalProperties: false,
      },
    },
    edits: {
      type: "array",
      description: "Specific, manual changes the user should make to their CV. Reference exact CV sections/lines.",
      items: {
        type: "object",
        properties: {
          location: { type: "string", description: "Where in the CV to edit (e.g. 'Experience > Acme Corp bullet 2', 'Skills section', 'Personal statement')" },
          current: { type: "string", description: "What the CV currently says (quote it). Use empty string if it's a missing section to add." },
          suggested: { type: "string", description: "Concrete suggested replacement or addition the user should write themselves" },
          why: { type: "string", description: "Which job requirement this serves" },
        },
        required: ["location", "current", "suggested", "why"],
        additionalProperties: false,
      },
    },
    keywords_to_add: {
      type: "array",
      items: { type: "string" },
      description: "Specific keywords/phrases from the JD that are missing from the CV and should be added where truthful",
    },
  },
  required: ["fit_score", "summary", "strengths", "gaps", "edits", "keywords_to_add"],
  additionalProperties: false,
};

export const analyseCvForJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: cv, error: cvErr }, { data: job, error: jobErr }] = await Promise.all([
      supabase
        .from("cvs")
        .select("id, user_id, extracted_text")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("jobs").select("*").eq("id", data.jobId).single(),
    ]);
    if (cvErr || !cv) throw new Error("Upload your CV first.");
    if (!cv.extracted_text) throw new Error("Your CV is still being parsed — try again in a moment.");
    if (jobErr || !job) throw new Error("Job not found");

    const result = await callAI({
      messages: [
        {
          role: "system",
          content:
            "You are a senior recruiter and CV coach. The candidate will edit their CV themselves — DO NOT rewrite it for them. Your job is to analyse the CV against this specific job and tell the user exactly what to change, where, and why. Be specific. Quote the CV. Reference the JD. No vague advice.",
        },
        {
          role: "user",
          content: `=== JOB ===
Company: ${job.company}
Role: ${job.role_title}
Location: ${job.location}
Type: ${job.job_type}

=== JOB DESCRIPTION ===
${job.description}

=== JOB REQUIREMENTS ===
${job.requirements ?? "(not separately listed)"}

=== CANDIDATE CV ===
${cv.extracted_text.slice(0, 12000)}

Now produce structured tailoring advice. For each edit, tell the user the exact location in their CV, what's there now, what they should write instead, and which JD requirement it addresses. Do not draft the new CV — just direct the user.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_cv_advice",
            description: "Report CV tailoring advice for this specific job",
            parameters: adviceSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_cv_advice" } },
    });

    const call = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("AI returned no advice");
    const parsed = JSON.parse(call.function.arguments);

    const { data: saved, error: saveErr } = await supabase
      .from("cv_advice")
      .insert({
        user_id: userId,
        job_id: data.jobId,
        cv_id: cv.id,
        fit_score: parsed.fit_score,
        summary: parsed.summary,
        strengths: parsed.strengths,
        gaps: parsed.gaps,
        edits: parsed.edits,
        keywords_to_add: parsed.keywords_to_add,
      })
      .select("id")
      .single();
    if (saveErr) console.error("Save advice failed", saveErr);

    return { id: saved?.id, advice: parsed };
  });

/* -------------------- Generate cover letter for a specific job -------------------- */

const toneOverridesSchema = z
  .object({
    directness: z.number().min(1).max(5).optional(),
    formality: z.number().min(1).max(5).optional(),
    confidence: z.number().min(1).max(5).optional(),
    detail_level: z.number().min(1).max(5).optional(),
    warmth: z.number().min(1).max(5).optional(),
    energy: z.number().min(1).max(5).optional(),
  })
  .partial()
  .optional();

export const generateCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      jobId: z.string().uuid(),
      toneOverrides: toneOverridesSchema,
      extraContext: z.string().max(2000).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [
      { data: cv, error: cvErr },
      { data: profile, error: profErr },
      { data: userProfile },
      { data: job, error: jobErr },
    ] = await Promise.all([
      supabase
        .from("cvs")
        .select("id, user_id, extracted_text")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("communication_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      supabase.from("jobs").select("*").eq("id", data.jobId).single(),
    ]);

    if (cvErr || !cv) throw new Error("Upload your CV first.");
    if (!cv.extracted_text) throw new Error("Your CV is still being parsed — try again in a moment.");
    if (profErr) throw new Error("Could not load voice profile");
    if (!profile) throw new Error("Please complete your voice profile first.");
    if (jobErr || !job) throw new Error("Job not found");

    // Merge saved profile with per-job overrides
    const merged = {
      directness: data.toneOverrides?.directness ?? profile.directness,
      formality: data.toneOverrides?.formality ?? profile.formality,
      confidence: data.toneOverrides?.confidence ?? profile.confidence,
      detail_level: data.toneOverrides?.detail_level ?? profile.detail_level,
      warmth: data.toneOverrides?.warmth ?? profile.warmth,
      energy: data.toneOverrides?.energy ?? profile.energy,
    };

    const scale = (v: number, low: string, high: string) => {
      if (v <= 2) return `Strongly ${low}`;
      if (v === 3) return `Balanced — slight lean to ${low}`;
      if (v === 4) return `Balanced — slight lean to ${high}`;
      return `Strongly ${high}`;
    };

    const voice = [
      `Directness: ${scale(merged.directness, "considered & nuanced", "direct & to-the-point")}`,
      `Formality: ${scale(merged.formality, "conversational", "formal & polished")}`,
      `Confidence: ${scale(merged.confidence, "humble & curious", "boldly confident")}`,
      `Detail: ${scale(merged.detail_level, "high-level & punchy", "specific & detailed")}`,
      `Warmth: ${scale(merged.warmth, "professional & reserved", "warm & personal")}`,
      `Energy: ${scale(merged.energy, "calm & measured", "energetic & enthusiastic")}`,
      profile.values_text ? `Values & themes: ${profile.values_text}` : null,
      profile.voice_summary ? `Voice notes: ${profile.voice_summary}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const candidateName = userProfile?.display_name || "the candidate";

    const system = `You are writing as ${candidateName}, applying to a specific role. The cover letter must sound unmistakably like this person — not like an AI template.

STRICT RULES:
- Match the voice profile EXACTLY. If it says direct, be direct. If warm, be warm.
- No clichés. Never use "I am writing to express my interest", "passionate", "team player", "go-getter".
- Use specific evidence from the CV. Name companies, projects, courses, numbers, outcomes.
- Address the role's actual needs from the JD, not generic platitudes.
- Open with a hook that's specific to the company, role, or sector — not the candidate.
- 3-4 short paragraphs. ~280-340 words. Plain text only — no markdown, no headers, no greeting line repetition.
- Begin with "Dear Hiring Manager," then the body, then a clean sign-off using the candidate's name.`;

    const user = `=== CANDIDATE CV ===
${cv.extracted_text.slice(0, 10000)}

=== ROLE ===
${job.role_title} at ${job.company}
Location: ${job.location}
Type: ${job.job_type}

=== JOB DESCRIPTION ===
${job.description}

=== JOB REQUIREMENTS ===
${job.requirements ?? "(not separately listed)"}

=== VOICE PROFILE ===
${voice}

${data.extraContext ? `=== ADDITIONAL CONTEXT FROM CANDIDATE ===\n${data.extraContext}\n` : ""}
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
        cv_id: cv.id,
        job_id: data.jobId,
        job_title: job.role_title,
        company: job.company,
        job_description: job.description,
        content,
        tone_overrides: data.toneOverrides ?? null,
        extra_context: data.extraContext ?? null,
      })
      .select("id")
      .single();

    if (saveErr) {
      console.error("Save letter failed", saveErr);
      throw new Error("Could not save the letter");
    }

    return { id: saved.id, content };
  });
