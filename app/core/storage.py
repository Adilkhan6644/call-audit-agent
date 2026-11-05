import io
import mimetypes
import uuid
from pathlib import Path
from typing import BinaryIO

import httpx

from app.core.config import settings
from app.core.exceptions import AppError

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg"}
MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024

# Real file bytes, not the extension or client Content-Type, decide the type.
_MAGIC_CHECKS = {
    ".wav": lambda h: h[:4] == b"RIFF" and h[8:12] == b"WAVE",
    ".ogg": lambda h: h[:4] == b"OggS",
    ".mp3": lambda h: h[:3] == b"ID3" or (len(h) >= 2 and h[0] == 0xFF and (h[1] & 0xE0) == 0xE0),
    ".m4a": lambda h: h[4:8] == b"ftyp",
}


def _upload(key: str, content_type: str, body: bytes) -> None:
    response = httpx.post(
        f"{settings.supabase_url}/storage/v1/object/{settings.supabase_bucket_name}/{key}",
        headers={
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "apikey": settings.supabase_service_key,
            "Content-Type": content_type,
        },
        content=body,
        timeout=30,
    )
    if response.status_code >= 400:
        raise AppError("Failed to store recording", status_code=502)


def delete_many(keys: list[str]) -> None:
    if not keys:
        return
    response = httpx.request(
        "DELETE",
        f"{settings.supabase_url}/storage/v1/object/{settings.supabase_bucket_name}",
        headers={
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "apikey": settings.supabase_service_key,
        },
        json={"prefixes": keys},
        timeout=30,
    )
    if response.status_code >= 400:
        raise AppError("Failed to delete old recordings", status_code=502)


def save(filename: str, stream: BinaryIO) -> tuple[str, int]:
    """Validate and upload an audio file to Supabase Storage. Returns (storage_key, size_bytes)."""
    extension = Path(filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise AppError(f"Unsupported file type: {extension or 'unknown'}", status_code=422)

    header = stream.read(16)
    if not _MAGIC_CHECKS[extension](header):
        raise AppError("File content does not match its extension", status_code=422)

    # ponytail: buffers the file in memory (capped at MAX_UPLOAD_SIZE_BYTES) before
    # a single upload call; switch to a streaming upload if memory use becomes a problem.
    buffer = io.BytesIO()
    buffer.write(header)
    size = len(header)
    while chunk := stream.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_UPLOAD_SIZE_BYTES:
            raise AppError("File exceeds maximum upload size", status_code=422)
        buffer.write(chunk)

    key = f"{uuid.uuid4().hex}{extension}"
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    _upload(key, content_type, buffer.getvalue())

    return key, size
