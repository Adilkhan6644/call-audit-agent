from fastapi import APIRouter, Depends, File, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core import storage
from app.core.exceptions import AppError, NotFoundError
from app.models.recording import Recording
from app.models.user import User
from app.schemas.recording import RecordingBatchItem, RecordingRead
from app.services.recordings import delete_previous_days_recordings

router = APIRouter(prefix="/recordings", tags=["Recordings"])


def _store_recording(file: UploadFile, owner_id: int, db: Session) -> Recording:
    key, size_bytes = storage.save(file.filename, file.file)
    recording = Recording(
        owner_id=owner_id,
        original_filename=file.filename,
        storage_key=key,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)
    return recording


def _get_own_recording(db: Session, recording_id: int, current_user: User) -> Recording:
    recording = (
        db.query(Recording)
        .filter_by(id=recording_id, owner_id=current_user.id)
        .first()
    )
    if recording is None:
        raise NotFoundError("Recording not found")
    return recording


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
    recording = _store_recording(file, current_user.id, db)
    delete_previous_days_recordings(db, current_user.id)
    return recording


@router.post(
    "/batch",
    response_model=list[RecordingBatchItem],
    status_code=201,
    summary="Upload multiple audio recordings, with per-file results",
)
def upload_recordings_batch(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RecordingBatchItem]:
    results = []
    for file in files:
        try:
            recording = _store_recording(file, current_user.id, db)
        except AppError as exc:
            results.append(
                RecordingBatchItem(filename=file.filename, success=False, error=exc.message)
            )
            continue
        results.append(
            RecordingBatchItem(
                filename=file.filename,
                success=True,
                recording=RecordingRead.model_validate(recording),
            )
        )

    delete_previous_days_recordings(db, current_user.id)
    return results


@router.get(
    "",
    response_model=list[RecordingRead],
    summary="List your own recordings",
)
def list_recordings(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Recording]:
    return (
        db.query(Recording)
        .filter_by(owner_id=current_user.id)
        .order_by(Recording.created_at.desc())
        .all()
    )


@router.get(
    "/{recording_id}",
    response_model=RecordingRead,
    summary="Get a recording's metadata",
)
def get_recording(
    recording_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Recording:
    return _get_own_recording(db, recording_id, current_user)


@router.get(
    "/{recording_id}/download",
    summary="Download a recording's audio file",
)
def download_recording(
    recording_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    recording = _get_own_recording(db, recording_id, current_user)
    content = storage.download(recording.storage_key)
    return Response(
        content=content,
        media_type=recording.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{recording.original_filename}"'
        },
    )
