"""add_version_to_workout_session_logs

Revision ID: 28398c4b3c60
Revises: b7d9284e31a1
Create Date: 2026-10-26 22:06:24.674982

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '28398c4b3c60'
down_revision: Union[str, Sequence[str], None] = 'b7d9284e31a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('workout_session_logs') as batch_op:
        batch_op.add_column(
            sa.Column('version', sa.Integer(), nullable=False, server_default='1')
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('workout_session_logs') as batch_op:
        batch_op.drop_column('version')
