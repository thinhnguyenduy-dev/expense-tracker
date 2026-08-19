"""add expense images column

Revision ID: c4f8a1d2e3b5
Revises: f1e2d3c4b5a6
Create Date: 2026-08-19 10:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4f8a1d2e3b5"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    expense_columns = [c["name"] for c in inspector.get_columns("expenses")]

    if "images" not in expense_columns:
        op.add_column(
            "expenses",
            sa.Column(
                "images",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'::json"),
            ),
        )


def downgrade() -> None:
    op.drop_column("expenses", "images")
