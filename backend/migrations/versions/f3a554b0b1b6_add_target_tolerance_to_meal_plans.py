"""add_target_tolerance_to_meal_plans

Revision ID: f3a554b0b1b6
Revises: 2000aca91639
Create Date: 2026-10-24 20:59:13.185403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a554b0b1b6'
down_revision: Union[str, Sequence[str], None] = '2000aca91639'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'meal_plans',
        sa.Column('target_tolerance_pct', sa.Float(), nullable=False, server_default=sa.text('10.0'))
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('meal_plans', 'target_tolerance_pct')
