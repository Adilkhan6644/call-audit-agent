from datetime import datetime

from pydantic import BaseModel


class AuditInstructionCreate(BaseModel):
    category_id: int
    content: str


class AuditInstructionRead(BaseModel):
    id: int
    category_id: int
    owner_id: int
    version: int
    content: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
