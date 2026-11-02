from datetime import datetime

from pydantic import BaseModel


class CategoryRead(BaseModel):
    id: int
    name: str
    is_builtin: bool
    owner_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
