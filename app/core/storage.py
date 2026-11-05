import uuid
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings
from app.core.exceptions import AppError

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg"}
MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024


def save(filename: str, stream: BinaryIO) -> str:
    extension = Path(filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise AppError(f"Unsupported file type: {extension or 'unknown'}", status_code=422)

    key = f"{uuid.uuid4().hex}{extension}"
    destination = get_path(key)
    destination.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    with destination.open("wb") as out:
        while chunk := stream.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_SIZE_BYTES:
                out.close()
                destination.unlink(missing_ok=True)
                raise AppError("File exceeds maximum upload size", status_code=422)
            out.write(chunk)

    return key


def get_path(key: str) -> Path:
    base = Path(settings.upload_dir).resolve()
    candidate = (base / key).resolve()
    if candidate != base and base not in candidate.parents:
        raise AppError("Invalid storage key", status_code=422)
    return candidate
