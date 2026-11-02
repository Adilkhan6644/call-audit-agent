from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories")


def _get_visible_category(db: Session, category_id: int, current_user: User) -> Category:
    category = (
        db.query(Category)
        .filter(
            Category.id == category_id,
            or_(Category.owner_id.is_(None), Category.owner_id == current_user.id),
        )
        .first()
    )
    if category is None:
        raise NotFoundError("Category not found")
    return category


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


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Category:
    return _get_visible_category(db, category_id, current_user)


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Category:
    category = _get_visible_category(db, category_id, current_user)
    if category.is_builtin:
        raise ForbiddenError("Built-in categories cannot be modified")

    category.name = payload.name
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    category = _get_visible_category(db, category_id, current_user)
    if category.is_builtin:
        raise ForbiddenError("Built-in categories cannot be deleted")

    db.delete(category)
    db.commit()
