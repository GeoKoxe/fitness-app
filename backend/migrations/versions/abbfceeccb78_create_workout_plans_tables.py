"""create_workout_plans_tables

Revision ID: abbfceeccb78
Revises: e30c1094053f
Create Date: 2026-10-25 12:07:24.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abbfceeccb78'
down_revision: Union[str, Sequence[str], None] = 'e30c1094053f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. workout_plans table
    op.create_table(
        'workout_plans',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_profile_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), server_default='7-Day Workout Routine', nullable=False),
        sa.Column('split_type', sa.String(length=50), server_default='full_body', nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('generation_settings', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_profile_id'], ['user_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workout_plans_id'), 'workout_plans', ['id'], unique=False)
    op.create_index(op.f('ix_workout_plans_user_profile_id'), 'workout_plans', ['user_profile_id'], unique=False)
    op.create_index(op.f('ix_workout_plans_is_active'), 'workout_plans', ['is_active'], unique=False)
    op.create_index(op.f('ix_workout_plans_start_date'), 'workout_plans', ['start_date'], unique=False)
    op.create_index(op.f('ix_workout_plans_end_date'), 'workout_plans', ['end_date'], unique=False)

    # 2. planned_workout_sessions table
    op.create_table(
        'planned_workout_sessions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workout_plan_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week_index', sa.Integer(), nullable=False),
        sa.Column('day_of_week_name', sa.String(length=20), nullable=False),
        sa.Column('plan_date', sa.Date(), nullable=False),
        sa.Column('is_rest_day', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('session_name', sa.String(length=100), nullable=False),
        sa.Column('session_focus', sa.String(length=100), nullable=False),
        sa.Column('estimated_duration_minutes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('warmup_notes', sa.Text(), nullable=True),
        sa.Column('cooldown_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['workout_plan_id'], ['workout_plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_planned_workout_sessions_id'), 'planned_workout_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_planned_workout_sessions_workout_plan_id'), 'planned_workout_sessions', ['workout_plan_id'], unique=False)
    op.create_index(op.f('ix_planned_workout_sessions_plan_date'), 'planned_workout_sessions', ['plan_date'], unique=False)
    op.create_index(op.f('ix_planned_workout_sessions_day_of_week_index'), 'planned_workout_sessions', ['day_of_week_index'], unique=False)

    # 3. planned_exercises table
    op.create_table(
        'planned_exercises',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('planned_session_id', sa.Integer(), nullable=False),
        sa.Column('exercise_id', sa.Integer(), nullable=True),
        sa.Column('order_in_session', sa.Integer(), nullable=False),
        sa.Column('exercise_slug', sa.String(length=100), nullable=False),
        sa.Column('exercise_name', sa.String(length=200), nullable=False),
        sa.Column('primary_muscle', sa.String(length=50), nullable=False),
        sa.Column('secondary_muscles', sa.String(length=200), nullable=True),
        sa.Column('movement_category', sa.String(length=50), nullable=False),
        sa.Column('equipment_required', sa.String(length=50), nullable=False),
        sa.Column('target_sets', sa.Integer(), server_default='3', nullable=False),
        sa.Column('target_reps', sa.String(length=50), server_default='8-12', nullable=False),
        sa.Column('rest_seconds', sa.Integer(), server_default='90', nullable=False),
        sa.Column('progression_notes', sa.Text(), nullable=True),
        sa.Column('warmup_guidance', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['planned_session_id'], ['planned_workout_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_planned_exercises_id'), 'planned_exercises', ['id'], unique=False)
    op.create_index(op.f('ix_planned_exercises_planned_session_id'), 'planned_exercises', ['planned_session_id'], unique=False)
    op.create_index(op.f('ix_planned_exercises_exercise_id'), 'planned_exercises', ['exercise_id'], unique=False)
    op.create_index(op.f('ix_planned_exercises_exercise_slug'), 'planned_exercises', ['exercise_slug'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_planned_exercises_exercise_slug'), table_name='planned_exercises')
    op.drop_index(op.f('ix_planned_exercises_exercise_id'), table_name='planned_exercises')
    op.drop_index(op.f('ix_planned_exercises_planned_session_id'), table_name='planned_exercises')
    op.drop_index(op.f('ix_planned_exercises_id'), table_name='planned_exercises')
    op.drop_table('planned_exercises')

    op.drop_index(op.f('ix_planned_workout_sessions_day_of_week_index'), table_name='planned_workout_sessions')
    op.drop_index(op.f('ix_planned_workout_sessions_plan_date'), table_name='planned_workout_sessions')
    op.drop_index(op.f('ix_planned_workout_sessions_workout_plan_id'), table_name='planned_workout_sessions')
    op.drop_index(op.f('ix_planned_workout_sessions_id'), table_name='planned_workout_sessions')
    op.drop_table('planned_workout_sessions')

    op.drop_index(op.f('ix_workout_plans_end_date'), table_name='workout_plans')
    op.drop_index(op.f('ix_workout_plans_start_date'), table_name='workout_plans')
    op.drop_index(op.f('ix_workout_plans_is_active'), table_name='workout_plans')
    op.drop_index(op.f('ix_workout_plans_user_profile_id'), table_name='workout_plans')
    op.drop_index(op.f('ix_workout_plans_id'), table_name='workout_plans')
    op.drop_table('workout_plans')
