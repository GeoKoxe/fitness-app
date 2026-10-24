from sqlalchemy import Column, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class NutritionGoal(Base, TimestampMixin):
    __tablename__ = "nutrition_goals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    calories_kcal = Column(Float, nullable=True)
    protein_g = Column(Float, nullable=True)
    carbs_g = Column(Float, nullable=True)
    fat_g = Column(Float, nullable=True)
    fiber_g = Column(Float, nullable=True)

    user_profile = relationship("UserProfile", back_populates="nutrition_goal")

