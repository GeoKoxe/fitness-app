from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


VALID_MEAL_CATEGORIES = ("breakfast", "lunch", "dinner", "snacks")


class MealLogBase(BaseModel):
    logged_date: date
    meal_category: str = Field(..., max_length=50)
    quantity: float = Field(..., gt=0.0, le=50000.0)
    unit: str = Field(default="g", max_length=20)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("meal_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        cat = v.lower().strip()
        if cat not in VALID_MEAL_CATEGORIES:
            raise ValueError(f"Invalid meal category '{v}'. Allowed: {', '.join(VALID_MEAL_CATEGORIES)}")
        return cat


class MealLogCreate(MealLogBase):
    food_id: Optional[int] = None
    # If food_id is provided, backend computes snapshot from food.
    # If custom inline entry without catalog food, snapshot fields can be supplied:
    food_name: Optional[str] = Field(None, max_length=200)
    food_brand: Optional[str] = Field(None, max_length=200)
    calories_kcal: Optional[float] = Field(None, ge=0.0, le=10000.0)
    protein_g: Optional[float] = Field(None, ge=0.0, le=1000.0)
    carbs_g: Optional[float] = Field(None, ge=0.0, le=1000.0)
    fat_g: Optional[float] = Field(None, ge=0.0, le=1000.0)
    fiber_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    sugar_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    saturated_fat_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    sodium_mg: Optional[float] = Field(None, ge=0.0, le=100000.0)


class MealLogUpdate(BaseModel):
    logged_date: Optional[date] = None
    meal_category: Optional[str] = None
    quantity: Optional[float] = Field(None, gt=0.0, le=50000.0)
    unit: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("meal_category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cat = v.lower().strip()
        if cat not in VALID_MEAL_CATEGORIES:
            raise ValueError(f"Invalid meal category '{v}'. Allowed: {', '.join(VALID_MEAL_CATEGORIES)}")
        return cat


class MealLogResponse(MealLogBase):
    id: int
    user_profile_id: int
    food_id: Optional[int] = None
    food_name: str
    food_brand: Optional[str] = None
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    saturated_fat_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DailyMacroTotals(BaseModel):
    calories_kcal: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    saturated_fat_g: Optional[float] = None
    sodium_mg: Optional[float] = None


class DailyNutritionSummary(BaseModel):
    logged_date: date
    totals: DailyMacroTotals
    by_category: dict[str, list[MealLogResponse]]
    total_entries: int

