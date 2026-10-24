from sqlalchemy import Boolean, Column, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class MealPlan(Base, TimestampMixin):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False, default="7-Day Meal Plan")
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    target_tolerance_pct = Column(Float, nullable=False, default=10.0, server_default="10.0")
    notes = Column(String(500), nullable=True)

    user_profile = relationship("UserProfile", backref="meal_plans")
    planned_meals = relationship(
        "PlannedMeal",
        back_populates="meal_plan",
        cascade="all, delete-orphan",
        order_by="PlannedMeal.plan_date.asc(), PlannedMeal.id.asc()",
    )
    shopping_list_items = relationship(
        "ShoppingListItem",
        back_populates="meal_plan",
        cascade="all, delete-orphan",
        order_by="ShoppingListItem.category.asc(), ShoppingListItem.ingredient_name.asc()",
    )


class PlannedMeal(Base):
    __tablename__ = "planned_meals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meal_plan_id = Column(
        Integer,
        ForeignKey("meal_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_date = Column(Date, nullable=False, index=True)
    day_number = Column(Integer, nullable=False)  # 1 to 7
    meal_category = Column(String(50), nullable=False, index=True)  # breakfast, lunch, dinner, snacks
    recipe_id = Column(
        Integer,
        ForeignKey("recipes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    food_id = Column(
        Integer,
        ForeignKey("foods.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name = Column(String(200), nullable=False)
    servings = Column(Float, nullable=False, default=1.0)

    # Calculated nutrition per planned meal
    calories_kcal = Column(Float, nullable=False, default=0.0)
    protein_g = Column(Float, nullable=False, default=0.0)
    carbs_g = Column(Float, nullable=False, default=0.0)
    fat_g = Column(Float, nullable=False, default=0.0)
    fiber_g = Column(Float, nullable=True)
    notes = Column(String(500), nullable=True)

    meal_plan = relationship("MealPlan", back_populates="planned_meals")
    recipe = relationship("Recipe")
    food = relationship("Food")
    items = relationship(
        "PlannedMealItem",
        back_populates="planned_meal",
        cascade="all, delete-orphan",
        order_by="PlannedMealItem.id.asc()",
    )


class PlannedMealItem(Base):
    __tablename__ = "planned_meal_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    planned_meal_id = Column(
        Integer,
        ForeignKey("planned_meals.id", ondelete="CASCADE"),
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

    calories_kcal = Column(Float, nullable=False, default=0.0)
    protein_g = Column(Float, nullable=False, default=0.0)
    carbs_g = Column(Float, nullable=False, default=0.0)
    fat_g = Column(Float, nullable=False, default=0.0)
    fiber_g = Column(Float, nullable=True)

    planned_meal = relationship("PlannedMeal", back_populates="items")
    food = relationship("Food")


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meal_plan_id = Column(
        Integer,
        ForeignKey("meal_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    food_id = Column(
        Integer,
        ForeignKey("foods.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ingredient_name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=True)
    total_quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False, default="g")
    preparation_state = Column(String(50), nullable=True)  # e.g. "raw", "cooked", "dry"
    is_checked = Column(Boolean, nullable=False, default=False)
    is_excluded = Column(Boolean, nullable=False, default=False)

    meal_plan = relationship("MealPlan", back_populates="shopping_list_items")
    food = relationship("Food")


class MealPlannerPreferences(Base, TimestampMixin):
    __tablename__ = "meal_planner_preferences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    enabled_categories = Column(String(200), nullable=False, default="breakfast,lunch,dinner,snacks")
    disliked_foods = Column(String(500), nullable=False, default="")  # comma-separated words
    max_cooking_time_minutes = Column(Integer, nullable=True)
    simplicity_preference = Column(String(50), nullable=False, default="simple")
    daily_budget = Column(Float, nullable=True)
    reuse_ingredients = Column(Boolean, nullable=False, default=True)
    target_tolerance_pct = Column(Float, nullable=False, default=10.0)

    user_profile = relationship("UserProfile", backref="planner_preferences")


class DislikedFood(Base, TimestampMixin):
    __tablename__ = "disliked_foods"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    food_id = Column(
        Integer,
        ForeignKey("foods.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    food_name = Column(String(200), nullable=False, index=True)

    user_profile = relationship("UserProfile", backref="disliked_foods")
    food = relationship("Food")

