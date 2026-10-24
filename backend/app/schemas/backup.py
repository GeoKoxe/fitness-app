from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.food import FoodResponse
from app.schemas.meal_log import MealLogResponse
from app.schemas.meal_plan import (
    DislikedFoodResponse,
    MealPlanResponse,
    PlannerPreferencesResponse,
)
from app.schemas.nutrition_goal import NutritionGoalResponse
from app.schemas.recipe import RecipeResponse


class NutritionExportData(BaseModel):
    version: str = "1.2"
    exported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    foods: List[FoodResponse] = []
    meal_logs: List[MealLogResponse] = []
    nutrition_goals: Optional[NutritionGoalResponse] = None
    recipes: List[RecipeResponse] = []
    meal_plans: List[MealPlanResponse] = []
    planner_preferences: Optional[PlannerPreferencesResponse] = None
    disliked_foods: List[DislikedFoodResponse] = []


class NutritionImportResult(BaseModel):
    success: bool
    imported_foods: int = 0
    imported_meal_logs: int = 0
    imported_goals: bool = False
    imported_recipes: int = 0
    imported_meal_plans: int = 0
    imported_disliked_foods: int = 0
    message: str
