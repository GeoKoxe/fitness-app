from sqlalchemy import Boolean, Column, Float, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Food(Base, TimestampMixin):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(200), nullable=False, index=True)
    brand = Column(String(200), nullable=True)
    category = Column(String(100), nullable=True)
    source = Column(String(50), nullable=False, default="manual")  # 'manual', 'open_food_facts', 'usda'
    external_id = Column(String(100), nullable=True, index=True)
    barcode = Column(String(100), nullable=True, index=True)

    nutritional_basis = Column(String(20), nullable=False, default="100g")  # '100g', '100ml', 'serving'
    serving_description = Column(String(100), nullable=True)
    serving_quantity = Column(Float, nullable=True)
    serving_unit = Column(String(20), nullable=True)

    # Core macronutrients (non-nullable base)
    calories_kcal = Column(Float, nullable=False, default=0.0)
    protein_g = Column(Float, nullable=False, default=0.0)
    carbs_g = Column(Float, nullable=False, default=0.0)
    fat_g = Column(Float, nullable=False, default=0.0)

    # Optional micronutrients (nullable to distinguish unknown from 0)
    fiber_g = Column(Float, nullable=True)
    sugar_g = Column(Float, nullable=True)
    saturated_fat_g = Column(Float, nullable=True)
    sodium_mg = Column(Float, nullable=True)

    is_favorite = Column(Boolean, nullable=False, default=False)

    # Relationship to logs (SET NULL preserves historical consumption records when food is deleted)
    meal_logs = relationship("MealLog", back_populates="food")
