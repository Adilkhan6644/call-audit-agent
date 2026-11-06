import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.exceptions import AppError
from app.core.internal_auth import require_internal_secret
from app.core.storage import ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES, _MAGIC_CHECKS
from app.schemas.audit_result import AuditResultSchema, validate_audit_result
from app.schemas.internal import AuditRequestIn, TranscriptResultOut, TranscriptSegmentOut
from app.services.ai_client_wrapper import call_with_retry
from app.services.llm.factory import get_llm_provider
from app.services.stt.factory import get_stt_provider

router = APIRouter(prefix="/internal", tags=["Internal"], dependencies=[Depends(require_internal_secret)])

# ponytail: transcription is CPU-bound and can run far longer than the 10s
# default used elsewhere; 120s matches the timeout already used for Deepgram.
_TRANSCRIBE_TIMEOUT_SECONDS = 120.0


@router.post("/transcribe", response_model=TranscriptResultOut, summary="Transcribe an audio file (AI service only)")
def transcribe(file: UploadFile = File(...)) -> TranscriptResultOut:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise AppError(f"Unsupported file type: {extension or 'unknown'}", status_code=422)

    header = file.file.read(16)
    if not _MAGIC_CHECKS[extension](header):
        raise AppError("File content does not match its extension", status_code=422)

    fd, tmp_path = tempfile.mkstemp(suffix=extension)
    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(header)
            size = len(header)
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_SIZE_BYTES:
                    raise AppError("File exceeds maximum upload size", status_code=422)
                tmp.write(chunk)

        provider = get_stt_provider()
        result = call_with_retry(provider.transcribe, tmp_path, timeout_seconds=_TRANSCRIBE_TIMEOUT_SECONDS)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return TranscriptResultOut(
        text=result.text,
        language=result.language,
        duration_seconds=result.duration_seconds,
        segments=[
            TranscriptSegmentOut(speaker=s.speaker, text=s.text, start=s.start, end=s.end)
            for s in result.segments
        ],
    )


@router.post("/audit", response_model=AuditResultSchema, summary="Audit a transcript against instructions (AI service only)")
def audit(payload: AuditRequestIn) -> AuditResultSchema:
    provider = get_llm_provider()
    result = call_with_retry(provider.audit, payload.transcript, payload.instructions)
    return validate_audit_result(
        {"summary": result.summary, "score": result.score, "findings": result.findings}
    )
