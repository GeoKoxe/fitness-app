from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class NutritionGoalBase(BaseModel):
    calories_kcal: Optional[float] = Field(None, ge=0.0, le=15000.0)
    protein_g: Optional[float] = Field(None, ge=0.0, le=2000.0)
    carbs_g: Optional[float] = Field(None, ge=0.0, le=2000.0)
    fat_g: Optional[float] = Field(None, ge=0.0, le=2000.0)
    fiber_g: Optional[float] = Field(None, ge=0.0, le=500.0)

    @field_validator("calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", mode="before")
    @classmethod
    def round_to_whole_number(cls, v):
        if v is not None:
            return round(float(v))
        return None


class NutritionGoalCreate(NutritionGoalBase):
    pass


class NutritionGoalUpdate(NutritionGoalBase):
    pass


class NutritionGoalResponse(NutritionGoalBase):
    id: Optional[int] = None
    user_profile_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class GeneratedProfile(BaseModel):
    key: str
    name: str
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    protein_pct: float
    carbs_pct: float
    fat_pct: float
    purpose: str
    explanation: str


class GenerateGoalsResponse(BaseModel):
    bmr_kcal: float
    tdee_kcal: float
    weight_kg: float
    height_cm: float
    age: int
    sex: str
    activity_level: str
    training_days_per_week: int
    training_goals: Optional[str] = None
    profiles: List[GeneratedProfile]
    formula_explanation: str
    disclaimer: str


class GoalEstimateResponse(BaseModel):
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    bmr_kcal: float
    tdee_kcal: float
    formula_explanation: str
    profiles: Optional[List[GeneratedProfile]] = None
