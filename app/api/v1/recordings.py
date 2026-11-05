from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core import storage
from app.models.recording import Recording
from app.models.user import User
from app.schemas.recording import RecordingRead

router = APIRouter(prefix="/recordings", tags=["Recordings"])


@router.post(
    "",
    response_model=RecordingRead,
    status_code=201,
    summary="Upload an audio recording",
)
def upload_recording(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Recording:
    key, size_bytes = storage.save(file.filename, file.file)

    recording = Recording(
        owner_id=current_user.id,
        original_filename=file.filename,
        storage_key=key,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)
    return recording
