from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class FoodBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    brand: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    source: str = Field(default="manual", max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    barcode: Optional[str] = Field(None, max_length=100)

    nutritional_basis: str = Field(default="100g", max_length=20)
    serving_description: Optional[str] = Field(None, max_length=100)
    serving_quantity: Optional[float] = Field(None, ge=0.1, le=10000.0)
    serving_unit: Optional[str] = Field(None, max_length=20)

    # Core macronutrients (per nutritional basis)
    calories_kcal: float = Field(..., ge=0.0, le=10000.0)
    protein_g: float = Field(..., ge=0.0, le=1000.0)
    carbs_g: float = Field(..., ge=0.0, le=1000.0)
    fat_g: float = Field(..., ge=0.0, le=1000.0)

    # Optional micronutrients
    fiber_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    sugar_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    saturated_fat_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    sodium_mg: Optional[float] = Field(None, ge=0.0, le=100000.0)

    is_favorite: bool = Field(default=False)

    @field_validator("name")
    @classmethod
    def validate_name_not_empty(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Food name cannot be empty.")
        return s


class FoodCreate(FoodBase):
    pass


class FoodSearchResult(FoodBase):
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FoodUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    brand: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    nutritional_basis: Optional[str] = Field(None, max_length=20)
    serving_description: Optional[str] = Field(None, max_length=100)
    serving_quantity: Optional[float] = Field(None, ge=0.1, le=10000.0)
    serving_unit: Optional[str] = Field(None, max_length=20)

    calories_kcal: Optional[float] = Field(None, ge=0.0, le=10000.0)
    protein_g: Optional[float] = Field(None, ge=0.0, le=1000.0)
    carbs_g: Optional[float] = Field(None, ge=0.0, le=1000.0)
    fat_g: Optional[float] = Field(None, ge=0.0, le=1000.0)

    fiber_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    sugar_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    saturated_fat_g: Optional[float] = Field(None, ge=0.0, le=500.0)
    sodium_mg: Optional[float] = Field(None, ge=0.0, le=100000.0)

    is_favorite: Optional[bool] = None


class FoodResponse(FoodBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FoodListResponse(BaseModel):
    items: list[FoodResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

