from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.food import FoodResponse
from app.schemas.meal_log import MealLogResponse
from app.schemas.nutrition_goal import NutritionGoalResponse


class NutritionExportData(BaseModel):
    version: str = "1.1"
    exported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    foods: List[FoodResponse]
    meal_logs: List[MealLogResponse]
    nutrition_goals: Optional[NutritionGoalResponse] = None


class NutritionImportResult(BaseModel):
    success: bool
    imported_foods: int
    imported_meal_logs: int
    imported_goals: bool = False
    message: str
