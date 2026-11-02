from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryRead

router = APIRouter(prefix="/categories")


@router.get("", response_model=list[CategoryRead])
def list_categories(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Category]:
    return (
        db.query(Category)
        .filter(or_(Category.owner_id.is_(None), Category.owner_id == current_user.id))
        .all()
    )


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Category:
    category = Category(
        name=payload.name, is_builtin=False, owner_id=current_user.id
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category
