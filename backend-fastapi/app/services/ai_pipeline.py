from __future__ import annotations

import json
import re
from typing import Any

import numpy as np
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.models.schemas import CvAdvice


class AiPipeline:
    def __init__(
        self,
        *,
        groq_api_key: str | None,
        groq_model: str,
        sentence_transformer_model: str,
    ) -> None:
        self._embedder = self._init_embedder(sentence_transformer_model)
        self._llm = self._init_llm(groq_api_key, groq_model)

    @staticmethod
    def _init_embedder(sentence_transformer_model: str) -> Any | None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            return None
        return SentenceTransformer(sentence_transformer_model)

    @staticmethod
    def _init_llm(groq_api_key: str | None, groq_model: str) -> ChatGroq | None:
        if not groq_api_key:
            return None

        try:
            return ChatGroq(model=groq_model, api_key=groq_api_key, temperature=0.2)
        except TypeError:
            return ChatGroq(model_name=groq_model, groq_api_key=groq_api_key, temperature=0.2)

    def semantic_fit_score(self, cv_text: str, job_text: str) -> int:
        cv_excerpt = cv_text[:7000]
        job_excerpt = job_text[:7000]

        if self._embedder is None:
            return self._token_overlap_score(cv_excerpt, job_excerpt)

        embeddings = self._embedder.encode([cv_excerpt, job_excerpt], normalize_embeddings=True)
        similarity = float(np.dot(embeddings[0], embeddings[1]))
        clamped = max(0.0, min(1.0, similarity))
        return int(round(clamped * 100))

    @staticmethod
    def _token_overlap_score(left_text: str, right_text: str) -> int:
        left_tokens = {token for token in re.findall(r"[a-zA-Z]{3,}", left_text.lower())}
        right_tokens = {token for token in re.findall(r"[a-zA-Z]{3,}", right_text.lower())}
        if not left_tokens or not right_tokens:
            return 0

        overlap = left_tokens.intersection(right_tokens)
        union = left_tokens.union(right_tokens)
        score = len(overlap) / len(union)
        return int(round(max(0.0, min(1.0, score)) * 100))

    async def generate_cv_advice(self, *, cv_text: str, job: dict[str, Any]) -> CvAdvice:
        job_requirements = job.get("requirements") or "(not separately listed)"
        job_text = f"{job.get('description', '')}\n\n{job_requirements}"
        fit_score = self.semantic_fit_score(cv_text, job_text)

        if self._llm is None:
            return self._fallback_cv_advice(fit_score)

        prompt = ChatPromptTemplate.from_template(
            """
You are a senior recruiter and CV coach.
Return ONLY valid JSON with this shape:
{{
  "fit_score": number,
  "summary": string,
  "strengths": [{{"point": string, "evidence": string}}],
  "gaps": [{{"point": string, "severity": "low|medium|high", "how_to_address": string}}],
  "edits": [{{"location": string, "current": string, "suggested": string, "why": string}}],
  "keywords_to_add": [string]
}}

Rules:
- Be specific and grounded in provided CV and JD text.
- Candidate edits CV manually; do not rewrite full CV.
- Keep output concise but actionable.

Suggested fit score from semantic similarity: {fit_score}

JOB
Company: {company}
Role: {role_title}
Location: {location}
Type: {job_type}

JOB DESCRIPTION
{description}

JOB REQUIREMENTS
{requirements}

CANDIDATE CV
{cv_text}
""".strip()
        )

        chain = prompt | self._llm | StrOutputParser()
        raw = await chain.ainvoke(
            {
                "fit_score": fit_score,
                "company": job.get("company", ""),
                "role_title": job.get("role_title", ""),
                "location": job.get("location", ""),
                "job_type": job.get("job_type", ""),
                "description": job.get("description", ""),
                "requirements": job_requirements,
                "cv_text": cv_text[:12000],
            }
        )

        payload = self._extract_json(raw)
        payload.setdefault("fit_score", fit_score)
        return CvAdvice.model_validate(payload)

    async def generate_cover_letter(
        self,
        *,
        cv_text: str,
        job: dict[str, Any],
        candidate_name: str,
        merged_tone: dict[str, int],
        values_text: str | None,
        voice_summary: str | None,
        extra_context: str | None,
    ) -> str:
        if self._llm is None:
            return self._fallback_cover_letter(candidate_name, job)

        voice_lines = [
            f"directness={merged_tone.get('directness', 3)}",
            f"formality={merged_tone.get('formality', 3)}",
            f"confidence={merged_tone.get('confidence', 3)}",
            f"detail_level={merged_tone.get('detail_level', 3)}",
            f"warmth={merged_tone.get('warmth', 3)}",
            f"energy={merged_tone.get('energy', 3)}",
        ]
        if values_text:
            voice_lines.append(f"values={values_text}")
        if voice_summary:
            voice_lines.append(f"voice_summary={voice_summary}")

        prompt = ChatPromptTemplate.from_template(
            """
You are writing as {candidate_name}, applying to a specific role.

Strict rules:
- Match the voice profile exactly.
- Use concrete evidence from CV.
- 3 to 4 short paragraphs.
- Around 280 to 340 words.
- Plain text only.
- Start with "Dear Hiring Manager," and end with the candidate name.

VOICE PROFILE
{voice_profile}

ROLE
{role_title} at {company}
Location: {location}
Type: {job_type}

JOB DESCRIPTION
{description}

JOB REQUIREMENTS
{requirements}

CANDIDATE CV
{cv_text}

ADDITIONAL CONTEXT
{extra_context}
""".strip()
        )

        chain = prompt | self._llm | StrOutputParser()
        raw = await chain.ainvoke(
            {
                "candidate_name": candidate_name,
                "voice_profile": "\n".join(voice_lines),
                "role_title": job.get("role_title", ""),
                "company": job.get("company", ""),
                "location": job.get("location", ""),
                "job_type": job.get("job_type", ""),
                "description": job.get("description", ""),
                "requirements": job.get("requirements") or "(not separately listed)",
                "cv_text": cv_text[:10000],
                "extra_context": extra_context or "",
            }
        )

        content = raw.strip()
        if not content:
            raise ValueError("AI returned no letter")
        return content

    @staticmethod
    def _extract_json(raw_text: str) -> dict[str, Any]:
        snippet = raw_text.strip()
        match = re.search(r"\{.*\}", snippet, flags=re.DOTALL)
        if match:
            snippet = match.group(0)

        try:
            payload = json.loads(snippet)
        except json.JSONDecodeError as exc:
            raise ValueError("AI returned invalid JSON") from exc

        if not isinstance(payload, dict):
            raise ValueError("AI returned invalid advice payload")
        return payload

    @staticmethod
    def _fallback_cv_advice(fit_score: int) -> CvAdvice:
        return CvAdvice(
            fit_score=fit_score,
            summary=(
                "Semantic scoring is available. Add GROQ_API_KEY for full LLM guidance and "
                "install requirements-ml.txt for sentence-transformers embeddings."
            ),
            strengths=[
                {
                    "point": "Baseline semantic alignment computed",
                    "evidence": "The CV and job description were compared with sentence-transformers embeddings.",
                }
            ],
            gaps=[
                {
                    "point": "Detailed recruiter-style gap analysis is pending",
                    "severity": "medium",
                    "how_to_address": "Configure GROQ_API_KEY to enable full multi-step advice generation.",
                }
            ],
            edits=[
                {
                    "location": "Professional summary",
                    "current": "",
                    "suggested": "Add 1 to 2 lines matching the role's strongest requirement keywords.",
                    "why": "Improves relevance for recruiter scanning.",
                }
            ],
            keywords_to_add=[],
        )

    @staticmethod
    def _fallback_cover_letter(candidate_name: str, job: dict[str, Any]) -> str:
        return (
            "Dear Hiring Manager,\n\n"
            f"I am applying for the {job.get('role_title', 'role')} position at {job.get('company', 'your company')}. "
            "I have aligned this application with the role requirements and can provide detailed evidence from my CV.\n\n"
            "This draft is a temporary fallback while Groq-backed generation is being configured. "
            "Set GROQ_API_KEY to enable full personalized output.\n\n"
            "Sincerely,\n"
            f"{candidate_name}"
        )
