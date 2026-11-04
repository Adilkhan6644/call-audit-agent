from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.v1.categories import _get_visible_category
from app.core.exceptions import NotFoundError
from app.models.audit_instruction import AuditInstruction
from app.models.user import User
from app.schemas.audit_instruction import AuditInstructionCreate, AuditInstructionRead
from app.services.audit_instructions import create_new_version

router = APIRouter(prefix="/audit-instructions")


@router.post("", response_model=AuditInstructionRead, status_code=201)
def create_instruction(
    payload: AuditInstructionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuditInstruction:
    _get_visible_category(db, payload.category_id, current_user)
    return create_new_version(db, payload.category_id, current_user.id, payload.content)


@router.get("", response_model=list[AuditInstructionRead])
def list_instructions(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AuditInstruction]:
    _get_visible_category(db, category_id, current_user)
    return (
        db.query(AuditInstruction)
        .filter_by(category_id=category_id, owner_id=current_user.id)
        .order_by(AuditInstruction.version)
        .all()
    )


@router.get("/active", response_model=AuditInstructionRead)
def get_active_instruction(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuditInstruction:
    _get_visible_category(db, category_id, current_user)
    instruction = (
        db.query(AuditInstruction)
        .filter_by(category_id=category_id, owner_id=current_user.id, is_active=True)
        .first()
    )
    if instruction is None:
        raise NotFoundError("No active instruction for this category")
    return instruction
