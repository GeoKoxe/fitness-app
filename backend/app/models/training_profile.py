from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class TrainingProfile(Base, TimestampMixin):
    __tablename__ = "training_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    experience_level = Column(String(30), nullable=False, default="beginner")
    training_goals = Column(String(200), nullable=False, default="general_fitness")
    available_days = Column(String(100), nullable=False, default="monday,wednesday,friday")
    preferred_duration_minutes = Column(Integer, nullable=False, default=60)
    available_equipment = Column(String(300), nullable=False, default="bodyweight,dumbbell")
    excluded_exercises = Column(String(500), nullable=True, default="")
    excluded_muscle_groups = Column(String(300), nullable=True, default="")
    training_considerations = Column(Text, nullable=True)

    user_profile = relationship("UserProfile", back_populates="training_profile")


class SavedTrainingProfile(Base, TimestampMixin):
    __tablename__ = "saved_training_profiles"
    __table_args__ = (
        UniqueConstraint(
            "user_profile_id", "name", name="uq_user_profile_saved_config_name"
        ),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(100), nullable=False)
    experience_level = Column(String(30), nullable=False, default="beginner")
    training_goals = Column(String(200), nullable=False, default="general_fitness")
    available_days = Column(String(100), nullable=False, default="monday,wednesday,friday")
    preferred_duration_minutes = Column(Integer, nullable=False, default=60)
    available_equipment = Column(String(300), nullable=False, default="bodyweight,dumbbell")
    excluded_exercises = Column(String(500), nullable=True, default="")
    excluded_muscle_groups = Column(String(300), nullable=True, default="")
    training_considerations = Column(Text, nullable=True)

    user_profile = relationship("UserProfile", backref="saved_training_profiles")

