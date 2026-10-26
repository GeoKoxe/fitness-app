from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.exercise import ExerciseResponse
from app.schemas.food import FoodResponse
from app.schemas.meal_log import MealLogResponse
from app.schemas.meal_plan import (
    DislikedFoodResponse,
    MealPlanResponse,
    PlannerPreferencesResponse,
)
from app.schemas.measurement import BodyMeasurementResponse
from app.schemas.nutrition_goal import NutritionGoalResponse
from app.schemas.profile import UserProfileResponse
from app.schemas.recipe import RecipeResponse
from app.schemas.training_profile import (
    SavedTrainingProfileResponse,
    TrainingProfileResponse,
)
from app.schemas.workout_log import WorkoutSessionLogResponse
from app.schemas.workout_plan import WorkoutPlanResponse


class NutritionExportData(BaseModel):
    version: str = "1.2"
    exported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    foods: List[FoodResponse] = Field(default_factory=list)
    meal_logs: List[MealLogResponse] = Field(default_factory=list)
    nutrition_goals: Optional[NutritionGoalResponse] = None
    recipes: List[RecipeResponse] = Field(default_factory=list)
    meal_plans: List[MealPlanResponse] = Field(default_factory=list)
    planner_preferences: Optional[PlannerPreferencesResponse] = None
    disliked_foods: List[DislikedFoodResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class NutritionBackupData(BaseModel):
    foods: List[FoodResponse] = Field(default_factory=list)
    meal_logs: List[MealLogResponse] = Field(default_factory=list)
    nutrition_goals: Optional[NutritionGoalResponse] = None
    recipes: List[RecipeResponse] = Field(default_factory=list)
    meal_plans: List[MealPlanResponse] = Field(default_factory=list)
    planner_preferences: Optional[PlannerPreferencesResponse] = None
    disliked_foods: List[DislikedFoodResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TrainingBackupData(BaseModel):
    custom_exercises: List[ExerciseResponse] = Field(default_factory=list)
    training_profile: Optional[TrainingProfileResponse] = None
    saved_training_profiles: List[SavedTrainingProfileResponse] = Field(
        default_factory=list
    )
    workout_plans: List[WorkoutPlanResponse] = Field(default_factory=list)
    workout_session_logs: List[WorkoutSessionLogResponse] = Field(
        default_factory=list
    )

    model_config = ConfigDict(from_attributes=True)


class SystemBackupV2(BaseModel):
    format: str = "fitpulse_backup"
    version: str = "2.0"
    exported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    app_version: str = "0.1.0"
    profile: Optional[UserProfileResponse] = None
    body_measurements: List[BodyMeasurementResponse] = Field(default_factory=list)
    nutrition: NutritionBackupData = Field(default_factory=NutritionBackupData)
    training: TrainingBackupData = Field(default_factory=TrainingBackupData)

    model_config = ConfigDict(from_attributes=True)


class BackupImportResult(BaseModel):
    success: bool
    imported_profile: bool = False
    imported_measurements: int = 0
    imported_foods: int = 0
    imported_meal_logs: int = 0
    imported_goals: bool = False
    imported_recipes: int = 0
    imported_meal_plans: int = 0
    imported_disliked_foods: int = 0
    imported_custom_exercises: int = 0
    imported_training_profile: bool = False
    imported_saved_training_profiles: int = 0
    imported_workout_plans: int = 0
    imported_workout_sessions: int = 0
    skipped_duplicates: int = 0
    message: str


# Backward compatibility alias
NutritionImportResult = BackupImportResult
