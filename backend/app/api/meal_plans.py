from typing import List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.meal_plan import MealPlan, MealPlannerPreferences, PlannedMeal
from app.repositories.profile_repository import profile_repository
from app.schemas.meal_plan import (
    DislikedFoodCreate,
    DislikedFoodResponse,
    DislikeIngredientRequest,
    DislikeIngredientResponse,
    LogPlannedMealRequest,
    LogPlannedMealResponse,
    MealPlanGenerateRequest,
    MealPlanResponse,
    MealPlanSummaryResponse,
    PlannedMealResponse,
    PlannerPreferencesResponse,
    PlannerPreferencesUpdate,
    ShoppingListExportResponse,
    ShoppingListItemResponse,
    ShoppingListItemUpdate,
)
from app.services.meal_planner_service import meal_planner_service
from app.services.shopping_list_service import shopping_list_service

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


def _get_profile_id(db: Session) -> int:
    profile = profile_repository.get_current_profile(db)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User profile not found. Please create a user profile before meal planning.",
        )
    return profile.id


@router.get("/active", response_model=Optional[MealPlanResponse])
def get_active_meal_plan(db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    plan = meal_planner_service.get_active_plan(db, profile_id)
    if not plan:
        return None
    return meal_planner_service.to_response(db, plan, profile_id)


@router.get("", response_model=List[MealPlanSummaryResponse])
def list_meal_plans(db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    plans = (
        db.query(MealPlan)
        .filter(MealPlan.user_profile_id == profile_id)
        .order_by(MealPlan.created_at.desc())
        .all()
    )
    result = []
    for p in plans:
        m_count = len(p.planned_meals)
        avg_cal = (
            sum(m.calories_kcal for m in p.planned_meals) / 7.0 if m_count > 0 else 0.0
        )
        result.append(
            MealPlanSummaryResponse(
                id=p.id,
                user_profile_id=p.user_profile_id,
                name=p.name,
                start_date=p.start_date,
                end_date=p.end_date,
                is_active=p.is_active,
                notes=p.notes,
                created_at=p.created_at,
                updated_at=p.updated_at,
                meals_count=m_count,
                average_daily_calories=round(avg_cal, 1),
            )
        )
    return result


# --- Disliked Foods Endpoints ---
@router.get("/disliked-foods", response_model=List[DislikedFoodResponse])
def get_disliked_foods(db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    return meal_planner_service.get_disliked_foods(db, profile_id)


@router.post("/disliked-foods", response_model=DislikedFoodResponse, status_code=status.HTTP_201_CREATED)
def add_disliked_food(req: DislikedFoodCreate, db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    return meal_planner_service.add_disliked_food(
        db, profile_id, food_name=req.food_name, food_id=req.food_id
    )


@router.delete("/disliked-foods/{disliked_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_disliked_food(disliked_id: int, db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    deleted = meal_planner_service.remove_disliked_food(db, profile_id, disliked_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Disliked food entry with id {disliked_id} not found.",
        )
    return None


@router.post("/dislike-and-regenerate", response_model=DislikeIngredientResponse)
def dislike_ingredient_and_regenerate(
    req: DislikeIngredientRequest, db: Session = Depends(get_db)
):
    profile_id = _get_profile_id(db)
    return meal_planner_service.dislike_ingredient_and_regenerate(
        db, profile_id, food_name=req.food_name, food_id=req.food_id
    )


@router.get("/{plan_id}", response_model=MealPlanResponse)
def get_meal_plan(plan_id: int, db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    plan = (
        db.query(MealPlan)
        .filter(MealPlan.id == plan_id, MealPlan.user_profile_id == profile_id)
        .first()
    )
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal plan with id {plan_id} not found.",
        )
    return meal_planner_service.to_response(db, plan, profile_id)


@router.post("/generate", response_model=MealPlanResponse, status_code=status.HTTP_201_CREATED)
def generate_meal_plan(
    req: MealPlanGenerateRequest, db: Session = Depends(get_db)
):
    profile_id = _get_profile_id(db)
    plan = meal_planner_service.generate_plan(db, profile_id, req)
    return meal_planner_service.to_response(db, plan, profile_id)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_plan(plan_id: int, db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    plan = (
        db.query(MealPlan)
        .filter(MealPlan.id == plan_id, MealPlan.user_profile_id == profile_id)
        .first()
    )
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal plan with id {plan_id} not found.",
        )
    meal_planner_service.delete_plan(db, plan_id)
    return None


@router.put("/planned-meals/{meal_id}/replace", response_model=MealPlanResponse)
def replace_planned_meal(
    meal_id: int,
    recipe_id: int = Query(...),
    servings: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    profile_id = _get_profile_id(db)
    meal = db.query(PlannedMeal).filter(PlannedMeal.id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned meal with id {meal_id} not found.",
        )
    meal_planner_service.replace_planned_meal(db, meal_id, recipe_id, servings)
    plan = db.query(MealPlan).filter(MealPlan.id == meal.meal_plan_id).first()
    return meal_planner_service.to_response(db, plan, profile_id)


@router.put("/planned-meals/{meal_id}/servings", response_model=MealPlanResponse)
def adjust_planned_meal_servings(
    meal_id: int,
    servings: float = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    profile_id = _get_profile_id(db)
    meal = db.query(PlannedMeal).filter(PlannedMeal.id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned meal with id {meal_id} not found.",
        )
    meal_planner_service.adjust_planned_meal_servings(db, meal_id, servings)
    plan = db.query(MealPlan).filter(MealPlan.id == meal.meal_plan_id).first()
    return meal_planner_service.to_response(db, plan, profile_id)


@router.post("/planned-meals/{meal_id}/regenerate", response_model=MealPlanResponse)
def regenerate_planned_meal(meal_id: int, db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    meal = db.query(PlannedMeal).filter(PlannedMeal.id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned meal with id {meal_id} not found.",
        )
    meal_planner_service.regenerate_planned_meal(db, meal_id, profile_id)
    plan = db.query(MealPlan).filter(MealPlan.id == meal.meal_plan_id).first()
    return meal_planner_service.to_response(db, plan, profile_id)


@router.post("/log-meals", response_model=LogPlannedMealResponse)
def log_planned_meals(
    req: LogPlannedMealRequest, db: Session = Depends(get_db)
):
    profile_id = _get_profile_id(db)
    return meal_planner_service.log_planned_meals(db, profile_id, req)


# --- Shopping List Endpoints ---
@router.get("/{plan_id}/shopping-list", response_model=List[ShoppingListItemResponse])
def get_shopping_list(plan_id: int, db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    plan = (
        db.query(MealPlan)
        .filter(MealPlan.id == plan_id, MealPlan.user_profile_id == profile_id)
        .first()
    )
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal plan with id {plan_id} not found.",
        )
    return shopping_list_service.get_shopping_list(db, plan_id)


@router.put("/shopping-list/{item_id}", response_model=ShoppingListItemResponse)
def update_shopping_list_item(
    item_id: int, req: ShoppingListItemUpdate, db: Session = Depends(get_db)
):
    updated = shopping_list_service.update_item(
        db, item_id, is_checked=req.is_checked, is_excluded=req.is_excluded
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list item with id {item_id} not found.",
        )
    return updated


@router.get("/{plan_id}/shopping-list/export", response_model=ShoppingListExportResponse)
def export_shopping_list(plan_id: int, db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    plan = (
        db.query(MealPlan)
        .filter(MealPlan.id == plan_id, MealPlan.user_profile_id == profile_id)
        .first()
    )
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal plan with id {plan_id} not found.",
        )
    exported = shopping_list_service.export_shopping_list(db, plan_id)
    if not exported:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unable to export shopping list.",
        )
    return exported


# --- Preferences Endpoints ---
@router.get("/preferences/me", response_model=PlannerPreferencesResponse)
def get_preferences(db: Session = Depends(get_db)):
    profile_id = _get_profile_id(db)
    pref = meal_planner_service.get_or_create_preferences(db, profile_id)
    return pref


@router.put("/preferences/me", response_model=PlannerPreferencesResponse)
def update_preferences(
    req: PlannerPreferencesUpdate, db: Session = Depends(get_db)
):
    profile_id = _get_profile_id(db)
    pref = meal_planner_service.get_or_create_preferences(db, profile_id)
    if req.enabled_categories is not None:
        pref.enabled_categories = req.enabled_categories
    if req.disliked_foods is not None:
        pref.disliked_foods = req.disliked_foods
    if req.max_cooking_time_minutes is not None:
        pref.max_cooking_time_minutes = req.max_cooking_time_minutes
    if req.simplicity_preference is not None:
        pref.simplicity_preference = req.simplicity_preference
    if req.daily_budget is not None:
        pref.daily_budget = req.daily_budget
    if req.reuse_ingredients is not None:
        pref.reuse_ingredients = req.reuse_ingredients
    if req.target_tolerance_pct is not None:
        pref.target_tolerance_pct = req.target_tolerance_pct
    db.commit()
    db.refresh(pref)
    return pref

