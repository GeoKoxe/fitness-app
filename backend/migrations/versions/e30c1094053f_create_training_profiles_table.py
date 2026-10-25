"""create_training_profiles_table

Revision ID: e30c1094053f
Revises: a7e48c19b2d3
Create Date: 2026-10-25 11:56:32.225949

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e30c1094053f'
down_revision: Union[str, Sequence[str], None] = 'a7e48c19b2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'training_profiles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_profile_id', sa.Integer(), nullable=False),
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
        sa.UniqueConstraint('user_profile_id')
    )
    op.create_index(op.f('ix_training_profiles_id'), 'training_profiles', ['id'], unique=False)
    op.create_index(op.f('ix_training_profiles_user_profile_id'), 'training_profiles', ['user_profile_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_training_profiles_user_profile_id'), table_name='training_profiles')
    op.drop_index(op.f('ix_training_profiles_id'), table_name='training_profiles')
    op.drop_table('training_profiles')
