from datetime import datetime

from pydantic import BaseModel

from app.models.recording import RecordingStatus


class RecordingRead(BaseModel):
    id: int
    original_filename: str
    content_type: str
    size_bytes: int
    status: RecordingStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class RecordingBatchItem(BaseModel):
    filename: str
    success: bool
    recording: RecordingRead | None = None
    error: str | None = None
