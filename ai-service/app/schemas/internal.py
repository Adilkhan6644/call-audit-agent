from pydantic import BaseModel


class TranscriptSegmentOut(BaseModel):
    speaker: str
    text: str
    start: float
    end: float


class TranscriptResultOut(BaseModel):
    text: str
    language: str
    duration_seconds: float
    segments: list[TranscriptSegmentOut]


class AuditRequestIn(BaseModel):
    transcript: str
    instructions: str
