from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Exercise(Base, TimestampMixin):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False, index=True)
    movement_category = Column(String(50), nullable=False, index=True)  # horizontal_push, vertical_pull, squat, hinge, etc.
    primary_muscle = Column(String(50), nullable=False, index=True)  # chest, lats, quadriceps, hamstrings, etc.
    secondary_muscles = Column(String(200), nullable=True)  # comma-separated tokens
    equipment_required = Column(String(50), nullable=False, index=True)  # barbell, dumbbell, bodyweight, cable, machine, etc.
    difficulty_level = Column(String(30), nullable=False, default="beginner", index=True)  # beginner, intermediate, advanced
    instructions = Column(Text, nullable=True)
    alternative_exercise_slugs = Column(String(250), nullable=True)  # comma-separated slugs for substitution
    is_built_in = Column(Boolean, nullable=False, default=False, index=True)

    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    user_profile = relationship("UserProfile", backref="custom_exercises")

