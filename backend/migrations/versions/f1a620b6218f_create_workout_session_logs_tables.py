"""create_workout_session_logs_tables

Revision ID: f1a620b6218f
Revises: abbfceeccb78
Create Date: 2026-10-25 12:21:55.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a620b6218f'
down_revision: Union[str, Sequence[str], None] = 'abbfceeccb78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. workout_session_logs table
    op.create_table(
        'workout_session_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_profile_id', sa.Integer(), nullable=False),
        sa.Column('workout_plan_id', sa.Integer(), nullable=True),
        sa.Column('planned_session_id', sa.Integer(), nullable=True),
        sa.Column('session_name', sa.String(length=100), nullable=False),
        sa.Column('session_focus', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='in_progress', nullable=False),
        sa.Column('started_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), server_default='0', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_profile_id'], ['user_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['workout_plan_id'], ['workout_plans.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['planned_session_id'], ['planned_workout_sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workout_session_logs_id'), 'workout_session_logs', ['id'], unique=False)
    op.create_index(op.f('ix_workout_session_logs_user_profile_id'), 'workout_session_logs', ['user_profile_id'], unique=False)
    op.create_index(op.f('ix_workout_session_logs_workout_plan_id'), 'workout_session_logs', ['workout_plan_id'], unique=False)
    op.create_index(op.f('ix_workout_session_logs_planned_session_id'), 'workout_session_logs', ['planned_session_id'], unique=False)
    op.create_index(op.f('ix_workout_session_logs_status'), 'workout_session_logs', ['status'], unique=False)
    op.create_index(op.f('ix_workout_session_logs_started_at'), 'workout_session_logs', ['started_at'], unique=False)

    # 2. logged_exercises table
    op.create_table(
        'logged_exercises',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('session_log_id', sa.Integer(), nullable=False),
        sa.Column('exercise_id', sa.Integer(), nullable=True),
        sa.Column('planned_exercise_id', sa.Integer(), nullable=True),
        sa.Column('order_in_session', sa.Integer(), nullable=False),
        sa.Column('exercise_slug', sa.String(length=100), nullable=False),
        sa.Column('exercise_name', sa.String(length=200), nullable=False),
        sa.Column('primary_muscle', sa.String(length=50), nullable=False),
        sa.Column('equipment_required', sa.String(length=50), nullable=False),
        sa.Column('movement_category', sa.String(length=50), nullable=False),
        sa.Column('target_sets', sa.Integer(), nullable=True),
        sa.Column('target_reps', sa.String(length=50), nullable=True),
        sa.Column('rest_seconds', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['session_log_id'], ['workout_session_logs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['planned_exercise_id'], ['planned_exercises.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_logged_exercises_id'), 'logged_exercises', ['id'], unique=False)
    op.create_index(op.f('ix_logged_exercises_session_log_id'), 'logged_exercises', ['session_log_id'], unique=False)
    op.create_index(op.f('ix_logged_exercises_exercise_id'), 'logged_exercises', ['exercise_id'], unique=False)

    # 3. logged_exercise_sets table
    op.create_table(
        'logged_exercise_sets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('logged_exercise_id', sa.Integer(), nullable=False),
        sa.Column('set_number', sa.Integer(), nullable=False),
        sa.Column('weight_kg', sa.Float(), nullable=True),
        sa.Column('reps', sa.Integer(), nullable=True),
        sa.Column('is_completed', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('is_skipped', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('notes', sa.String(length=255), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['logged_exercise_id'], ['logged_exercises.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_logged_exercise_sets_id'), 'logged_exercise_sets', ['id'], unique=False)
    op.create_index(op.f('ix_logged_exercise_sets_logged_exercise_id'), 'logged_exercise_sets', ['logged_exercise_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_logged_exercise_sets_logged_exercise_id'), table_name='logged_exercise_sets')
    op.drop_index(op.f('ix_logged_exercise_sets_id'), table_name='logged_exercise_sets')
    op.drop_table('logged_exercise_sets')

    op.drop_index(op.f('ix_logged_exercises_exercise_id'), table_name='logged_exercises')
    op.drop_index(op.f('ix_logged_exercises_session_log_id'), table_name='logged_exercises')
    op.drop_index(op.f('ix_logged_exercises_id'), table_name='logged_exercises')
    op.drop_table('logged_exercises')

    op.drop_index(op.f('ix_workout_session_logs_started_at'), table_name='workout_session_logs')
    op.drop_index(op.f('ix_workout_session_logs_status'), table_name='workout_session_logs')
    op.drop_index(op.f('ix_workout_session_logs_planned_session_id'), table_name='workout_session_logs')
    op.drop_index(op.f('ix_workout_session_logs_workout_plan_id'), table_name='workout_session_logs')
    op.drop_index(op.f('ix_workout_session_logs_user_profile_id'), table_name='workout_session_logs')
    op.drop_index(op.f('ix_workout_session_logs_id'), table_name='workout_session_logs')
    op.drop_table('workout_session_logs')
