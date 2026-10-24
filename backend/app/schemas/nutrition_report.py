from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class DailyReportItem(BaseModel):
    date: date
    has_logs: bool
    entries_count: int
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None


class WeightTrendReport(BaseModel):
    has_sufficient_data: bool
    measurement_count: int
    start_date: Optional[date] = None
    start_weight_kg: Optional[float] = None
    end_date: Optional[date] = None
    end_weight_kg: Optional[float] = None
    weight_change_kg: Optional[float] = None
    disclaimer: str


class NutritionReportResponse(BaseModel):
    start_date: date
    end_date: date
    total_days: int
    days_with_logs: int
    days_without_logs: int

    # Averages calculated strictly over days with logged meals
    avg_calories_kcal: Optional[float] = None
    avg_protein_g: Optional[float] = None
    avg_carbs_g: Optional[float] = None
    avg_fat_g: Optional[float] = None
    avg_fiber_g: Optional[float] = None

    calculation_note: str

    daily_items: List[DailyReportItem]
    weight_trend: WeightTrendReport

    model_config = ConfigDict(from_attributes=True)

