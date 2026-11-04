from sqlalchemy.orm import Session

from app.models.audit_instruction import AuditInstruction


def create_new_version(
    db: Session, category_id: int, owner_id: int, content: str
) -> AuditInstruction:
    latest = (
        db.query(AuditInstruction)
        .filter_by(category_id=category_id, owner_id=owner_id)
        .order_by(AuditInstruction.version.desc())
        .first()
    )
    if latest is not None and latest.is_active:
        latest.is_active = False

    instruction = AuditInstruction(
        category_id=category_id,
        owner_id=owner_id,
        version=(latest.version + 1) if latest else 1,
        content=content,
        is_active=True,
    )
    db.add(instruction)
    db.commit()
    db.refresh(instruction)
    return instruction
