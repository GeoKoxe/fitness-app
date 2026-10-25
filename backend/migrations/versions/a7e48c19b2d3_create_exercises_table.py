"""create_exercises_table

Revision ID: a7e48c19b2d3
Revises: f3a554b0b1b6
Create Date: 2026-10-25 11:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7e48c19b2d3'
down_revision: Union[str, Sequence[str], None] = 'f3a554b0b1b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'exercises',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('movement_category', sa.String(length=50), nullable=False),
        sa.Column('primary_muscle', sa.String(length=50), nullable=False),
        sa.Column('secondary_muscles', sa.String(length=200), nullable=True),
        sa.Column('equipment_required', sa.String(length=50), nullable=False),
        sa.Column('difficulty_level', sa.String(length=30), server_default='beginner', nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('alternative_exercise_slugs', sa.String(length=250), nullable=True),
        sa.Column('is_built_in', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('user_profile_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_profile_id'], ['user_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_exercises_id'), 'exercises', ['id'], unique=False)
    op.create_index(op.f('ix_exercises_slug'), 'exercises', ['slug'], unique=True)
    op.create_index(op.f('ix_exercises_name'), 'exercises', ['name'], unique=False)
    op.create_index(op.f('ix_exercises_movement_category'), 'exercises', ['movement_category'], unique=False)
    op.create_index(op.f('ix_exercises_primary_muscle'), 'exercises', ['primary_muscle'], unique=False)
    op.create_index(op.f('ix_exercises_equipment_required'), 'exercises', ['equipment_required'], unique=False)
    op.create_index(op.f('ix_exercises_difficulty_level'), 'exercises', ['difficulty_level'], unique=False)
    op.create_index(op.f('ix_exercises_is_built_in'), 'exercises', ['is_built_in'], unique=False)
    op.create_index(op.f('ix_exercises_user_profile_id'), 'exercises', ['user_profile_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_exercises_user_profile_id'), table_name='exercises')
    op.drop_index(op.f('ix_exercises_is_built_in'), table_name='exercises')
    op.drop_index(op.f('ix_exercises_difficulty_level'), table_name='exercises')
    op.drop_index(op.f('ix_exercises_equipment_required'), table_name='exercises')
    op.drop_index(op.f('ix_exercises_primary_muscle'), table_name='exercises')
    op.drop_index(op.f('ix_exercises_movement_category'), table_name='exercises')
    op.drop_index(op.f('ix_exercises_name'), table_name='exercises')
    op.drop_index(op.f('ix_exercises_slug'), table_name='exercises')
    op.drop_index(op.f('ix_exercises_id'), table_name='exercises')
    op.drop_table('exercises')

