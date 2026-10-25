"""create_saved_training_profiles_table

Revision ID: b7d9284e31a1
Revises: f1a620b6218f
Create Date: 2026-10-25 14:18:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d9284e31a1'
down_revision: Union[str, Sequence[str], None] = 'f1a620b6218f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'saved_training_profiles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_profile_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('experience_level', sa.String(length=30), server_default='beginner', nullable=False),
        sa.Column('training_goals', sa.String(length=200), server_default='general_fitness', nullable=False),
        sa.Column('available_days', sa.String(length=100), server_default='monday,wednesday,friday', nullable=False),
        sa.Column('preferred_duration_minutes', sa.Integer(), server_default='60', nullable=False),
        sa.Column('available_equipment', sa.String(length=300), server_default='bodyweight,dumbbell', nullable=False),
        sa.Column('excluded_exercises', sa.String(length=500), server_default='', nullable=True),
        sa.Column('excluded_muscle_groups', sa.String(length=300), server_default='', nullable=True),
        sa.Column('training_considerations', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_profile_id'], ['user_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_profile_id', 'name', name='uq_user_profile_saved_config_name'),
    )
    op.create_index(
        op.f('ix_saved_training_profiles_id'),
        'saved_training_profiles',
        ['id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_saved_training_profiles_user_profile_id'),
        'saved_training_profiles',
        ['user_profile_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_saved_training_profiles_user_profile_id'),
        table_name='saved_training_profiles',
    )
    op.drop_index(
        op.f('ix_saved_training_profiles_id'),
        table_name='saved_training_profiles',
    )
    op.drop_table('saved_training_profiles')

