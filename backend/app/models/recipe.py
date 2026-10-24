from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Recipe(Base, TimestampMixin):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name = Column(String(200), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    meal_category = Column(String(50), nullable=False, default="any")  # breakfast, lunch, dinner, snacks, any
    servings = Column(Integer, nullable=False, default=1)
    prep_time_minutes = Column(Integer, nullable=False, default=5)
    cook_time_minutes = Column(Integer, nullable=False, default=0)
    instructions = Column(Text, nullable=True)
    tags = Column(String(200), nullable=True)  # comma-separated, e.g. "high-protein,quick,fiber-rich"
    is_built_in = Column(Boolean, nullable=False, default=False)

    ingredients = relationship(
        "RecipeIngredient",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeIngredient.id.asc()",
    )
    user_profile = relationship("UserProfile", backref="recipes")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    recipe_id = Column(
        Integer,
        ForeignKey("recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    food_id = Column(
        Integer,
        ForeignKey("foods.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False, default="g")
    preparation_notes = Column(String(100), nullable=True)  # e.g. "raw weight", "cooked", "chopped"

    recipe = relationship("Recipe", back_populates="ingredients")
    food = relationship("Food")

