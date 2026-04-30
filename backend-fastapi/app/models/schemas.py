from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str


class CreateSessionResponse(BaseModel):
    userId: UUID
    csrfToken: str = Field(min_length=16, max_length=512)


class ClearSessionResponse(BaseModel):
    cleared: Literal[True]


class ExtractCvTextRequest(BaseModel):
    cvId: UUID


class ExtractCvTextResponse(BaseModel):
    text: str
    length: int


class AdviceStrength(BaseModel):
    point: str
    evidence: str


class AdviceGap(BaseModel):
    point: str
    severity: Literal["low", "medium", "high"]
    how_to_address: str


class AdviceEdit(BaseModel):
    location: str
    current: str
    suggested: str
    why: str


class CvAdvice(BaseModel):
    fit_score: int = Field(ge=0, le=100)
    summary: str
    strengths: list[AdviceStrength]
    gaps: list[AdviceGap]
    edits: list[AdviceEdit]
    keywords_to_add: list[str]


class AnalyseCvForJobRequest(BaseModel):
    jobId: UUID


class AnalyseCvForJobResponse(BaseModel):
    id: UUID | None = None
    advice: CvAdvice


class ToneOverrides(BaseModel):
    directness: int | None = Field(default=None, ge=1, le=5)
    formality: int | None = Field(default=None, ge=1, le=5)
    confidence: int | None = Field(default=None, ge=1, le=5)
    detail_level: int | None = Field(default=None, ge=1, le=5)
    warmth: int | None = Field(default=None, ge=1, le=5)
    energy: int | None = Field(default=None, ge=1, le=5)


class GenerateCoverLetterRequest(BaseModel):
    jobId: UUID
    toneOverrides: ToneOverrides | None = None
    extraContext: str | None = Field(default=None, max_length=2000)


class GenerateCoverLetterResponse(BaseModel):
    id: UUID
    content: str
