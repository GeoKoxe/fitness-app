from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# --- Planned Meal Items ---
class PlannedMealItemBase(BaseModel):
    food_id: Optional[int] = None
    food_name: Optional[str] = None
    quantity: float = Field(gt=0)
    unit: str = "g"
    calories_kcal: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    fiber_g: Optional[float] = None


class PlannedMealItemCreate(PlannedMealItemBase):
    pass


class PlannedMealItemResponse(PlannedMealItemBase):
    id: int
    planned_meal_id: int

    model_config = ConfigDict(from_attributes=True)


# --- Planned Meals ---
class PlannedMealBase(BaseModel):
    plan_date: date
    day_number: int = Field(ge=1, le=7, description="1 to 7")
    meal_category: str = Field(description="breakfast, lunch, dinner, snacks")
    recipe_id: Optional[int] = None
    food_id: Optional[int] = None
    name: str
    servings: float = Field(default=1.0, gt=0)
    notes: Optional[str] = None


class PlannedMealResponse(PlannedMealBase):
    id: int
    meal_plan_id: int
    items: List[PlannedMealItemResponse] = []
    calories_kcal: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    fiber_g: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class PlannedMealUpdate(BaseModel):
    recipe_id: Optional[int] = None
    food_id: Optional[int] = None
    name: Optional[str] = None
    servings: Optional[float] = Field(default=None, gt=0)
    notes: Optional[str] = None
    items: Optional[List[PlannedMealItemCreate]] = None


# --- Day & Weekly Overviews ---
class DayMealPlanResponse(BaseModel):
    day_number: int
    plan_date: date
    day_name: str
    meals: List[PlannedMealResponse] = []
    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0
    total_fiber: float = 0.0


class UnmetConstraintDetail(BaseModel):
    target_name: str
    target_value: float
    actual_value: float
    tolerance_pct: float
    upper_limit: float
    status: str  # "acceptable", "exceeded", "under"
    suggestion: Optional[str] = None


class WeeklyNutritionOverview(BaseModel):
    average_daily_calories: float = 0.0
    average_daily_protein: float = 0.0
    average_daily_carbs: float = 0.0
    average_daily_fat: float = 0.0
    average_daily_fiber: float = 0.0

    target_calories: Optional[float] = None
    target_protein: Optional[float] = None
    target_carbs: Optional[float] = None
    target_fat: Optional[float] = None
    target_fiber: Optional[float] = None

    tolerance_pct: float = 10.0
    adherence_calories_pct: Optional[float] = None
    adherence_protein_pct: Optional[float] = None
    adherence_carbs_pct: Optional[float] = None
    adherence_fat_pct: Optional[float] = None
    adherence_fiber_pct: Optional[float] = None

    unmet_constraints: List[UnmetConstraintDetail] = []


# --- Meal Plans ---
class MealPlanBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date
    target_tolerance_pct: float = 10.0
    notes: Optional[str] = None


class MealPlanCreate(MealPlanBase):
    pass


class MealPlanUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class MealPlanResponse(MealPlanBase):
    id: int
    user_profile_id: int
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    days: List[DayMealPlanResponse] = []
    weekly_overview: WeeklyNutritionOverview = Field(default_factory=WeeklyNutritionOverview)

    model_config = ConfigDict(from_attributes=True)


class MealPlanSummaryResponse(MealPlanBase):
    id: int
    user_profile_id: int
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    meals_count: int = 0
    average_daily_calories: float = 0.0

    model_config = ConfigDict(from_attributes=True)


# --- Generation Request ---
class MealPlanGenerateRequest(BaseModel):
    name: Optional[str] = "7-Day Meal Plan"
    start_date: Optional[date] = None
    enabled_categories: List[str] = Field(
        default=["breakfast", "lunch", "dinner", "snacks"],
        description="Daily meal categories to plan",
    )
    disliked_foods: List[str] = Field(
        default_factory=list,
        description="Ingredient or food keywords to strictly exclude using word boundaries",
    )
    max_cooking_time_minutes: Optional[int] = None
    target_calories: Optional[float] = None
    target_protein: Optional[float] = None
    target_carbs: Optional[float] = None
    target_fat: Optional[float] = None
    target_fiber: Optional[float] = None
    simplicity_preference: str = Field(
        default="simple",
        description="'simple' (reusable ingredients / batch), 'varied' (maximize daily variation)",
    )
    reuse_ingredients: bool = Field(
        default=True,
        description="Prioritize recipes using overlapping fresh ingredients to reduce waste",
    )
    daily_budget: Optional[float] = None
    target_tolerance_pct: Optional[float] = Field(
        default=None,
        ge=10.0,
        le=15.0,
        description="Acceptable daily target tolerance percentage (10% to 15%)",
    )


# --- Shopping List ---
class ShoppingListItemResponse(BaseModel):
    id: int
    meal_plan_id: int
    food_id: Optional[int] = None
    ingredient_name: str
    category: str
    total_quantity: float
    unit: str
    preparation_state: Optional[str] = None
    is_checked: bool
    is_excluded: bool

    model_config = ConfigDict(from_attributes=True)


class ShoppingListItemUpdate(BaseModel):
    is_checked: Optional[bool] = None
    is_excluded: Optional[bool] = None


class ShoppingListExportResponse(BaseModel):
    meal_plan_id: int
    meal_plan_name: str
    total_items_count: int
    checked_items_count: int
    categories: Dict[str, List[ShoppingListItemResponse]]
    plain_text: str


# --- Logging Planned Meals into Diary ---
class LogPlannedMealRequest(BaseModel):
    target_date: date
    planned_meal_id: Optional[int] = None
    day_number: Optional[int] = None  # If logging entire day's meals
    skip_if_already_logged: bool = True


class LoggedItemSummary(BaseModel):
    food_name: str
    quantity: float
    unit: str
    meal_log_id: int


class LogPlannedMealResponse(BaseModel):
    success: bool
    logged_count: int
    skipped_count: int
    message: str
    logged_items: List[LoggedItemSummary] = []


# --- Planner Preferences ---
class PlannerPreferencesBase(BaseModel):
    enabled_categories: str = "breakfast,lunch,dinner,snacks"
    disliked_foods: str = ""
    max_cooking_time_minutes: Optional[int] = None
    simplicity_preference: str = "simple"
    daily_budget: Optional[float] = None
    reuse_ingredients: bool = True
    target_tolerance_pct: float = Field(default=10.0, ge=10.0, le=15.0)


class PlannerPreferencesUpdate(BaseModel):
    enabled_categories: Optional[str] = None
    disliked_foods: Optional[str] = None
    max_cooking_time_minutes: Optional[int] = None
    simplicity_preference: Optional[str] = None
    daily_budget: Optional[float] = None
    reuse_ingredients: Optional[bool] = None
    target_tolerance_pct: Optional[float] = Field(default=None, ge=10.0, le=15.0)


class PlannerPreferencesResponse(PlannerPreferencesBase):
    id: int
    user_profile_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Disliked Foods Schemas ---
class DislikedFoodCreate(BaseModel):
    food_id: Optional[int] = None
    food_name: str = Field(min_length=1, max_length=200)


class DislikedFoodResponse(BaseModel):
    id: int
    user_profile_id: int
    food_id: Optional[int] = None
    food_name: str
    food_category: Optional[str] = None
    food_source: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DislikeIngredientRequest(BaseModel):
    food_id: Optional[int] = None
    food_name: str = Field(min_length=1, max_length=200)


class DislikeIngredientResponse(BaseModel):
    disliked_food: DislikedFoodResponse
    affected_meals_count: int
    regenerated_meals_count: int
    failed_meals_count: int
    message: str
    plan: Optional[MealPlanResponse] = None
