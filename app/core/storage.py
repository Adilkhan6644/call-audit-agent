import io
import mimetypes
import uuid
from pathlib import Path
from typing import BinaryIO

import boto3
from botocore.config import Config

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


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def save(filename: str, stream: BinaryIO) -> tuple[str, int]:
    """Validate and upload an audio file to R2. Returns (storage_key, size_bytes)."""
    extension = Path(filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise AppError(f"Unsupported file type: {extension or 'unknown'}", status_code=422)

    header = stream.read(16)
    if not _MAGIC_CHECKS[extension](header):
        raise AppError("File content does not match its extension", status_code=422)

    # ponytail: buffers the file in memory (capped at MAX_UPLOAD_SIZE_BYTES) before
    # a single PUT; switch to a streaming multipart upload if memory use becomes a problem.
    buffer = io.BytesIO(header)
    size = len(header)
    while chunk := stream.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_UPLOAD_SIZE_BYTES:
            raise AppError("File exceeds maximum upload size", status_code=422)
        buffer.write(chunk)

    key = f"{uuid.uuid4().hex}{extension}"
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    _client().put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=buffer.getvalue(),
        ContentType=content_type,
    )

    return key, size
