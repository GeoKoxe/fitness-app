from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.nutrition_goal import (
    GenerateGoalsResponse,
    GoalEstimateResponse,
    NutritionGoalResponse,
    NutritionGoalUpdate,
)
from app.schemas.nutrition_report import NutritionReportResponse
from app.services.nutrition_goal_service import nutrition_goal_service
from app.services.nutrition_report_service import nutrition_report_service

router = APIRouter(prefix="/nutrition", tags=["Nutrition Goals & Reports"])


@router.get(
    "/goals",
    response_model=NutritionGoalResponse,
    summary="Get user's daily nutrition goals",
)
def get_nutrition_goals(db: Session = Depends(get_db)) -> NutritionGoalResponse:
    return nutrition_goal_service.get_goals(db)


@router.put(
    "/goals",
    response_model=NutritionGoalResponse,
    summary="Update or create user's daily nutrition goals",
)
def update_nutrition_goals(
    goal_in: NutritionGoalUpdate, db: Session = Depends(get_db)
) -> NutritionGoalResponse:
    return nutrition_goal_service.update_goals(db, goal_in)


@router.get(
    "/goals/estimate",
    response_model=GoalEstimateResponse,
    summary="Get non-clinical reference estimate for daily nutrition goals",
)
def estimate_nutrition_goals(db: Session = Depends(get_db)) -> GoalEstimateResponse:
    return nutrition_goal_service.estimate_goals(db)


@router.get(
    "/goals/generate",
    response_model=GenerateGoalsResponse,
    summary="Generate 3 personalized non-clinical daily nutrition goal profiles (Weight Loss, Sustainability, Bulking)",
)
def generate_nutrition_goals(db: Session = Depends(get_db)) -> GenerateGoalsResponse:
    return nutrition_goal_service.generate_goal_profiles(db)


@router.get(
    "/reports",
    response_model=NutritionReportResponse,
    summary="Get historical daily and weekly nutrition summaries with weight trend",
)
def get_nutrition_report(
    start_date: date = Query(
        default_factory=lambda: date.today() - timedelta(days=6),
        description="Start date (YYYY-MM-DD)",
    ),
    end_date: date = Query(
        default_factory=date.today,
        description="End date (YYYY-MM-DD)",
    ),
    db: Session = Depends(get_db),
) -> NutritionReportResponse:
    return nutrition_report_service.get_report(
        db, start_date=start_date, end_date=end_date
    )
