from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class WorkoutSessionLog(Base, TimestampMixin):
    __tablename__ = "workout_session_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workout_plan_id = Column(
        Integer,
        ForeignKey("workout_plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    planned_session_id = Column(
        Integer,
        ForeignKey("planned_workout_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    session_name = Column(String(100), nullable=False)
    session_focus = Column(String(100), nullable=True)
    status = Column(
        String(20), nullable=False, default="in_progress", index=True
    )  # in_progress, completed, cancelled
    started_at = Column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=True)

    user_profile = relationship("UserProfile", backref="workout_session_logs")
    workout_plan = relationship("WorkoutPlan")
    planned_session = relationship("PlannedWorkoutSession")
    exercises = relationship(
        "LoggedExercise",
        back_populates="session_log",
        cascade="all, delete-orphan",
        order_by="LoggedExercise.order_in_session.asc()",
    )


class LoggedExercise(Base):
    __tablename__ = "logged_exercises"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_log_id = Column(
        Integer,
        ForeignKey("workout_session_logs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exercise_id = Column(
        Integer,
        ForeignKey("exercises.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    planned_exercise_id = Column(
        Integer,
        ForeignKey("planned_exercises.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    order_in_session = Column(Integer, nullable=False)

    # Snapshot fields
    exercise_slug = Column(String(100), nullable=False)
    exercise_name = Column(String(200), nullable=False)
    primary_muscle = Column(String(50), nullable=False)
    equipment_required = Column(String(50), nullable=False)
    movement_category = Column(String(50), nullable=False)

    # Planned prescription snapshot
    target_sets = Column(Integer, nullable=True)
    target_reps = Column(String(50), nullable=True)
    rest_seconds = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    session_log = relationship("WorkoutSessionLog", back_populates="exercises")
    exercise = relationship("Exercise")
    planned_exercise = relationship("PlannedExercise")
    sets = relationship(
        "LoggedExerciseSet",
        back_populates="logged_exercise",
        cascade="all, delete-orphan",
        order_by="LoggedExerciseSet.set_number.asc()",
    )


class LoggedExerciseSet(Base):
    __tablename__ = "logged_exercise_sets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    logged_exercise_id = Column(
        Integer,
        ForeignKey("logged_exercises.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    set_number = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=True)
    reps = Column(Integer, nullable=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    is_skipped = Column(Boolean, nullable=False, default=False)
    notes = Column(String(255), nullable=True)
    completed_at = Column(DateTime, nullable=True)

    logged_exercise = relationship("LoggedExercise", back_populates="sets")

