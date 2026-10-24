from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RecipeIngredientBase(BaseModel):
    food_id: int
    quantity: float = Field(gt=0, description="Quantity of ingredient")
    unit: str = Field(default="g", description="Unit (g, ml, serving)")
    preparation_notes: Optional[str] = None


class RecipeIngredientCreate(RecipeIngredientBase):
    pass


class RecipeIngredientResponse(RecipeIngredientBase):
    id: int
    food_name: Optional[str] = None
    food_category: Optional[str] = None
    calories_kcal: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class RecipeBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    meal_category: str = Field(default="any")  # breakfast, lunch, dinner, snacks, any
    servings: int = Field(default=1, ge=1)
    prep_time_minutes: int = Field(default=5, ge=0)
    cook_time_minutes: int = Field(default=0, ge=0)
    instructions: Optional[str] = None
    tags: Optional[str] = None  # comma-separated string e.g. "high-protein,quick"


class RecipeCreate(RecipeBase):
    ingredients: List[RecipeIngredientCreate] = []


class RecipeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    meal_category: Optional[str] = None
    servings: Optional[int] = Field(default=None, ge=1)
    prep_time_minutes: Optional[int] = Field(default=None, ge=0)
    cook_time_minutes: Optional[int] = Field(default=None, ge=0)
    instructions: Optional[str] = None
    tags: Optional[str] = None
    ingredients: Optional[List[RecipeIngredientCreate]] = None


class RecipeResponse(RecipeBase):
    id: int
    user_profile_id: Optional[int] = None
    is_built_in: bool = False
    created_at: datetime
    updated_at: datetime
    ingredients: List[RecipeIngredientResponse] = []

    # Aggregated nutritional values for the entire recipe
    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0
    total_fiber: float = 0.0

    # Per serving values (total / servings)
    per_serving_calories: float = 0.0
    per_serving_protein: float = 0.0
    per_serving_carbs: float = 0.0
    per_serving_fat: float = 0.0
    per_serving_fiber: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class RecipeSummaryResponse(RecipeBase):
    id: int
    user_profile_id: Optional[int] = None
    is_built_in: bool = False
    ingredients_count: int = 0
    per_serving_calories: float = 0.0
    per_serving_protein: float = 0.0
    per_serving_carbs: float = 0.0
    per_serving_fat: float = 0.0
    per_serving_fiber: float = 0.0

    model_config = ConfigDict(from_attributes=True)
