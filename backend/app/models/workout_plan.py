from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class WorkoutPlan(Base, TimestampMixin):
    __tablename__ = "workout_plans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False, default="7-Day Workout Routine")
    split_type = Column(String(50), nullable=False, default="full_body")
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    generation_settings = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    user_profile = relationship("UserProfile", backref="workout_plans")
    sessions = relationship(
        "PlannedWorkoutSession",
        back_populates="workout_plan",
        cascade="all, delete-orphan",
        order_by="PlannedWorkoutSession.day_of_week_index.asc()",
    )


class PlannedWorkoutSession(Base):
    __tablename__ = "planned_workout_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workout_plan_id = Column(
        Integer,
        ForeignKey("workout_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    day_of_week_index = Column(Integer, nullable=False, index=True)  # 0=Monday..6=Sunday
    day_of_week_name = Column(String(20), nullable=False)
    plan_date = Column(Date, nullable=False, index=True)
    is_rest_day = Column(Boolean, nullable=False, default=False)
    session_name = Column(String(100), nullable=False)
    session_focus = Column(String(100), nullable=False)
    estimated_duration_minutes = Column(Integer, nullable=False, default=0)
    warmup_notes = Column(Text, nullable=True)
    cooldown_notes = Column(Text, nullable=True)

    workout_plan = relationship("WorkoutPlan", back_populates="sessions")
    exercises = relationship(
        "PlannedExercise",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="PlannedExercise.order_in_session.asc()",
    )


class PlannedExercise(Base):
    __tablename__ = "planned_exercises"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    planned_session_id = Column(
        Integer,
        ForeignKey("planned_workout_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exercise_id = Column(
        Integer,
        ForeignKey("exercises.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    order_in_session = Column(Integer, nullable=False)

    # Exercise snapshot (preserves details even if catalogue entries change/deleted)
    exercise_slug = Column(String(100), nullable=False, index=True)
    exercise_name = Column(String(200), nullable=False)
    primary_muscle = Column(String(50), nullable=False)
    secondary_muscles = Column(String(200), nullable=True)
    movement_category = Column(String(50), nullable=False)
    equipment_required = Column(String(50), nullable=False)

    # Prescription
    target_sets = Column(Integer, nullable=False, default=3)
    target_reps = Column(String(50), nullable=False, default="8-12")
    rest_seconds = Column(Integer, nullable=False, default=90)
    progression_notes = Column(Text, nullable=True)
    warmup_guidance = Column(Text, nullable=True)

    session = relationship("PlannedWorkoutSession", back_populates="exercises")
    exercise = relationship("Exercise")

