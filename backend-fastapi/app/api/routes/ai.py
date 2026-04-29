from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import RequestContext, get_ai_pipeline, get_request_context
from app.models.schemas import (
    AnalyseCvForJobRequest,
    AnalyseCvForJobResponse,
    ExtractCvTextRequest,
    ExtractCvTextResponse,
    GenerateCoverLetterRequest,
    GenerateCoverLetterResponse,
)
from app.services.ai_pipeline import AiPipeline
from app.services.pdf_extractor import extract_text_from_pdf
from app.services.supabase_rest import SupabaseApiError

router = APIRouter(tags=["ai"])


def _status_for_value_error(message: str) -> int:
    if message.startswith("AI returned"):
        return 502
    return 400


@router.post("/cv/extract", response_model=ExtractCvTextResponse)
async def extract_cv_text(
    payload: ExtractCvTextRequest,
    ctx: RequestContext = Depends(get_request_context),
) -> ExtractCvTextResponse:
    try:
        cv = await ctx.supabase.fetch_cv_by_id(str(payload.cvId))
        if not cv:
            raise HTTPException(status_code=404, detail="CV not found")
        if cv.get("user_id") != ctx.user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        storage_path = str(cv.get("storage_path", "")).strip()
        if not storage_path:
            raise HTTPException(status_code=400, detail="Could not download CV file")

        pdf_bytes = await ctx.supabase.download_cv_file(storage_path)
        cleaned = extract_text_from_pdf(pdf_bytes)
        await ctx.supabase.update_cv_text(str(cv.get("id")), cleaned)

        return ExtractCvTextResponse(text=cleaned, length=len(cleaned))
    except SupabaseApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except ValueError as exc:
        raise HTTPException(status_code=_status_for_value_error(str(exc)), detail=str(exc)) from exc


@router.post("/cv/analyse", response_model=AnalyseCvForJobResponse)
async def analyse_cv_for_job(
    payload: AnalyseCvForJobRequest,
    ctx: RequestContext = Depends(get_request_context),
    ai_pipeline: AiPipeline = Depends(get_ai_pipeline),
) -> AnalyseCvForJobResponse:
    try:
        cv, job = await asyncio.gather(
            ctx.supabase.fetch_latest_cv(ctx.user_id),
            ctx.supabase.fetch_job(str(payload.jobId)),
        )

        if not cv:
            raise HTTPException(status_code=400, detail="Upload your CV first.")
        cv_text = str(cv.get("extracted_text") or "").strip()
        if not cv_text:
            raise HTTPException(status_code=400, detail="Your CV is still being parsed - try again in a moment.")
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        advice = await ai_pipeline.generate_cv_advice(cv_text=cv_text, job=job)
        advice_id = await ctx.supabase.insert_cv_advice(
            {
                "user_id": ctx.user_id,
                "job_id": str(payload.jobId),
                "cv_id": str(cv.get("id")),
                "fit_score": advice.fit_score,
                "summary": advice.summary,
                "strengths": [item.model_dump() for item in advice.strengths],
                "gaps": [item.model_dump() for item in advice.gaps],
                "edits": [item.model_dump() for item in advice.edits],
                "keywords_to_add": advice.keywords_to_add,
            }
        )

        return AnalyseCvForJobResponse(id=advice_id, advice=advice)
    except SupabaseApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except ValueError as exc:
        raise HTTPException(status_code=_status_for_value_error(str(exc)), detail=str(exc)) from exc


@router.post("/cover-letters/generate", response_model=GenerateCoverLetterResponse)
async def generate_cover_letter(
    payload: GenerateCoverLetterRequest,
    ctx: RequestContext = Depends(get_request_context),
    ai_pipeline: AiPipeline = Depends(get_ai_pipeline),
) -> GenerateCoverLetterResponse:
    try:
        cv, profile, user_profile, job = await asyncio.gather(
            ctx.supabase.fetch_latest_cv(ctx.user_id),
            ctx.supabase.fetch_communication_profile(ctx.user_id),
            ctx.supabase.fetch_user_profile(ctx.user_id),
            ctx.supabase.fetch_job(str(payload.jobId)),
        )

        if not cv:
            raise HTTPException(status_code=400, detail="Upload your CV first.")
        cv_text = str(cv.get("extracted_text") or "").strip()
        if not cv_text:
            raise HTTPException(status_code=400, detail="Your CV is still being parsed - try again in a moment.")
        if not profile:
            raise HTTPException(status_code=400, detail="Please complete your voice profile first.")
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        merged_tone = {
            "directness": int(profile.get("directness", 3)),
            "formality": int(profile.get("formality", 3)),
            "confidence": int(profile.get("confidence", 3)),
            "detail_level": int(profile.get("detail_level", 3)),
            "warmth": int(profile.get("warmth", 3)),
            "energy": int(profile.get("energy", 3)),
        }

        override_payload = payload.toneOverrides.model_dump(exclude_none=True) if payload.toneOverrides else {}
        merged_tone.update({k: int(v) for k, v in override_payload.items()})

        candidate_name = str((user_profile or {}).get("display_name") or "the candidate")

        content = await ai_pipeline.generate_cover_letter(
            cv_text=cv_text,
            job=job,
            candidate_name=candidate_name,
            merged_tone=merged_tone,
            values_text=profile.get("values_text"),
            voice_summary=profile.get("voice_summary"),
            extra_context=payload.extraContext,
        )

        row_id = await ctx.supabase.insert_cover_letter(
            {
                "user_id": ctx.user_id,
                "cv_id": str(cv.get("id")),
                "job_id": str(payload.jobId),
                "job_title": job.get("role_title"),
                "company": job.get("company"),
                "job_description": job.get("description"),
                "content": content,
                "tone_overrides": override_payload or None,
                "extra_context": payload.extraContext,
            }
        )

        return GenerateCoverLetterResponse(id=row_id, content=content)
    except SupabaseApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except ValueError as exc:
        raise HTTPException(status_code=_status_for_value_error(str(exc)), detail=str(exc)) from exc
