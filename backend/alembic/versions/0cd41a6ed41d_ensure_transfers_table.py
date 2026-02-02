"""ensure_transfers_table

Revision ID: 0cd41a6ed41d
Revises: d8aaa1229a9d
Create Date: 2026-02-02 17:26:08.746822

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0cd41a6ed41d'
down_revision: Union[str, None] = 'd8aaa1229a9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'transfers' not in tables:
        op.create_table('transfers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('from_jar_id', sa.Integer(), nullable=False),
            sa.Column('to_jar_id', sa.Integer(), nullable=False),
            sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('note', sa.String(length=255), nullable=True),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['from_jar_id'], ['jars.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['to_jar_id'], ['jars.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_transfers_id'), 'transfers', ['id'], unique=False)


def downgrade() -> None:
    # No downgrade operation needed as this is a fix migration 
    # that ensures existence. If we really wanted to revert, we might drop it,
    # but since previous migrations also claim to create it, dropping it might be wrong.
    pass
