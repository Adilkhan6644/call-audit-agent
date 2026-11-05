from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core import storage
from app.models.recording import Recording


def delete_previous_days_recordings(db: Session, owner_id: int) -> None:
    """Keep only today's recordings for this user; delete everything older (DB + storage)."""
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    stale = (
        db.query(Recording)
        .filter(Recording.owner_id == owner_id, Recording.created_at < today_start)
        .all()
    )
    if not stale:
        return

    storage.delete_many([recording.storage_key for recording in stale])
    for recording in stale:
        db.delete(recording)
    db.commit()
