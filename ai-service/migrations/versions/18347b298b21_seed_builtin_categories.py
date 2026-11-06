"""seed builtin categories

Revision ID: 18347b298b21
Revises: 4c12d9a39378
Create Date: 2026-11-02 11:57:27.615466

"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '18347b298b21'
down_revision: Union[str, None] = '4c12d9a39378'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BUILTIN_CATEGORY_NAMES = [
    "Medical Billing",
    "Sales Support",
    "Front Desk / Patient Services",
    "Customer Support / Service",
    "Collections / Payment Follow-up",
]

categories_table = sa.table(
    "categories",
    sa.column("name", sa.String),
    sa.column("is_builtin", sa.Boolean),
    sa.column("owner_id", sa.Integer),
    sa.column("created_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        categories_table,
        [
            {"name": name, "is_builtin": True, "owner_id": None, "created_at": now}
            for name in BUILTIN_CATEGORY_NAMES
        ],
    )


def downgrade() -> None:
    op.execute(
        categories_table.delete().where(categories_table.c.is_builtin.is_(True))
    )
