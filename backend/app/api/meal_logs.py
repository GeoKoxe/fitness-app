from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.food import FoodResponse
from app.schemas.meal_log import (
    DailyNutritionSummary,
    MealLogCreate,
    MealLogResponse,
    MealLogUpdate,
)
from app.services.meal_log_service import meal_log_service

router = APIRouter(prefix="/meal-logs", tags=["Meal Logs"])


@router.post(
    "",
    response_model=MealLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log food consumption to a meal and date",
)
def create_meal_log(
    log_in: MealLogCreate, db: Session = Depends(get_db)
) -> MealLogResponse:
    log = meal_log_service.create_meal_log(db, log_in)
    return MealLogResponse.model_validate(log)


@router.get(
    "/summary",
    response_model=DailyNutritionSummary,
    summary="Get daily nutrition totals and logs grouped by meal category",
)
def get_daily_summary(
    date_val: date = Query(..., alias="date", description="Target date in YYYY-MM-DD"),
    db: Session = Depends(get_db),
) -> DailyNutritionSummary:
    return meal_log_service.get_daily_summary(db, target_date=date_val)


@router.get(
    "/recent-foods",
    response_model=List[FoodResponse],
    summary="Get frequently / recently logged foods",
)
def get_recent_foods(
    limit: int = Query(10, ge=1, le=50, description="Max recent items"),
    db: Session = Depends(get_db),
) -> List[FoodResponse]:
    return meal_log_service.get_recent_foods(db, limit=limit)


@router.get(
    "/{log_id}",
    response_model=MealLogResponse,
    summary="Get single meal log details",
)
def get_meal_log(log_id: int, db: Session = Depends(get_db)) -> MealLogResponse:
    log = meal_log_service.get_meal_log(db, log_id)
    return MealLogResponse.model_validate(log)


@router.patch(
    "/{log_id}",
    response_model=MealLogResponse,
    summary="Update logged meal entry (quantity, unit, meal category, notes)",
)
def update_meal_log(
    log_id: int, log_in: MealLogUpdate, db: Session = Depends(get_db)
) -> MealLogResponse:
    log = meal_log_service.update_meal_log(db, log_id, log_in)
    return MealLogResponse.model_validate(log)


@router.delete(
    "/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a logged meal entry",
)
def delete_meal_log(log_id: int, db: Session = Depends(get_db)) -> None:
    meal_log_service.delete_meal_log(db, log_id)

