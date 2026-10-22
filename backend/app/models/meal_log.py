from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class MealLog(Base, TimestampMixin):
    __tablename__ = "meal_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Nullable with ondelete="SET NULL" so deleting a food never deletes historical consumption
    food_id = Column(
        Integer,
        ForeignKey("foods.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    logged_date = Column(Date, nullable=False, index=True)
    meal_category = Column(String(50), nullable=False, index=True)  # 'breakfast', 'lunch', 'dinner', 'snacks'
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False, default="g")  # 'g', 'ml', 'serving'

    # Immutable historical nutritional snapshot at the time of logging
    food_name = Column(String(200), nullable=False)
    food_brand = Column(String(200), nullable=True)
    calories_kcal = Column(Float, nullable=False)
    protein_g = Column(Float, nullable=False)
    carbs_g = Column(Float, nullable=False)
    fat_g = Column(Float, nullable=False)
    fiber_g = Column(Float, nullable=True)
    sugar_g = Column(Float, nullable=True)
    saturated_fat_g = Column(Float, nullable=True)
    sodium_mg = Column(Float, nullable=True)

    notes = Column(String(500), nullable=True)

    food = relationship("Food", back_populates="meal_logs")

