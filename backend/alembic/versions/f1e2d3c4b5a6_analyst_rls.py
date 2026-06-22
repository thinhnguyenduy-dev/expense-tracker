"""row-level security for the read-only analyst role

Hard-bounds the agent's SQL tool to the current user. Even if the LLM
writes a clever JOIN/subquery or scans `users`, Postgres RLS filters every row
to `user_id = current_setting('app.user_id')`. The main app role owns the
tables and bypasses RLS, so this is a no-op for normal app traffic; only the
non-owner `analyst_ro` role (used by the SQL tool) is constrained.

See app/agents/analyst.py — the guarded query tool runs as `analyst_ro` and
sets `app.user_id` per query. The string-based guard there stays as a second
layer of defence.

Revision ID: f1e2d3c4b5a6
Revises: 0cd41a6ed41d
Create Date: 2026-06-11 00:00:00.000000

"""
import os
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = '0cd41a6ed41d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, owner column) — the column that must equal the current user's id.
_RLS_TABLES = [
    ("expenses", "user_id"),
    ("incomes", "user_id"),
    ("categories", "user_id"),
    ("jars", "user_id"),
    ("recurring_expenses", "user_id"),
    ("goals", "user_id"),
    ("transfers", "user_id"),
    ("users", "id"),
]

_POLICY = "analyst_user_isolation"
_ROLE = "analyst_ro"


def upgrade() -> None:
    conn = op.get_bind()
    existing = set(sa.inspect(conn).get_table_names())

    # 1. Enable RLS + a SELECT policy on every user-owned table. A missing/NULL
    #    `app.user_id` matches nothing (deny-by-default).
    for table, column in _RLS_TABLES:
        if table not in existing:
            continue
        conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        conn.execute(text(f"DROP POLICY IF EXISTS {_POLICY} ON {table}"))
        # NULLIF(..., '') so an unset/blank app.user_id yields NULL (matches no
        # rows) instead of raising on the `''::int` cast — i.e. fail closed.
        conn.execute(text(
            f"CREATE POLICY {_POLICY} ON {table} "
            f"FOR SELECT USING ({column} = NULLIF(current_setting('app.user_id', true), '')::int)"
        ))

    # 2. Provision the read-only role the analyst connects as. Best-effort: if
    #    the migration role lacks CREATEROLE this is skipped with a notice — the
    #    operator can create the role manually (see backend/.env.example).
    _provision_role(conn)


def _provision_role(conn) -> None:
    password = os.environ.get("ANALYST_DB_PASSWORD", "analyst_ro_dev_pw")
    dbname = conn.engine.url.database
    try:
        # Idempotent role creation. Password is quoted as a literal via DO block.
        conn.execute(text(
            "DO $$ BEGIN "
            "  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :role) THEN "
            f"    EXECUTE format('CREATE ROLE {_ROLE} LOGIN PASSWORD %L', :pwd); "
            "  END IF; "
            "END $$;"
        ).bindparams(role=_ROLE, pwd=password))

        conn.execute(text(f'GRANT CONNECT ON DATABASE "{dbname}" TO {_ROLE}'))
        conn.execute(text(f"GRANT USAGE ON SCHEMA public TO {_ROLE}"))
        conn.execute(text(f"GRANT SELECT ON ALL TABLES IN SCHEMA public TO {_ROLE}"))
        conn.execute(text(
            f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO {_ROLE}"
        ))
        # Belt-and-braces: the role must never be allowed to bypass RLS.
        conn.execute(text(f"ALTER ROLE {_ROLE} NOBYPASSRLS"))
    except Exception as exc:  # pragma: no cover - depends on DB privileges
        print(
            f"[analyst-rls] Skipped provisioning role '{_ROLE}': {exc}. "
            f"Create it manually and grant SELECT — see backend/.env.example."
        )


def downgrade() -> None:
    conn = op.get_bind()
    existing = set(sa.inspect(conn).get_table_names())
    for table, _ in _RLS_TABLES:
        if table not in existing:
            continue
        conn.execute(text(f"DROP POLICY IF EXISTS {_POLICY} ON {table}"))
        conn.execute(text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
    # Leave the analyst_ro role in place; dropping it can fail if objects depend
    # on it. Revoke is left to the operator.
