from datetime import date
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.domain.nutrition import scale_food_nutrients
from app.models.meal_log import MealLog
from app.repositories.food_repository import food_repository
from app.repositories.meal_log_repository import meal_log_repository
from app.repositories.profile_repository import profile_repository
from app.schemas.food import FoodResponse
from app.schemas.meal_log import (
    DailyMacroTotals,
    DailyNutritionSummary,
    MealLogCreate,
    MealLogResponse,
    MealLogUpdate,
)


class MealLogService:
    def create_meal_log(
        self, db: Session, log_in: MealLogCreate
    ) -> MealLog:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile before logging meals.",
            )

        snapshot: Dict[str, Any] = {}
        if log_in.food_id:
            food = food_repository.get_by_id(db, log_in.food_id)
            if not food:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Food with id {log_in.food_id} not found.",
                )

            scaled = scale_food_nutrients(
                calories_kcal=food.calories_kcal,
                protein_g=food.protein_g,
                carbs_g=food.carbs_g,
                fat_g=food.fat_g,
                quantity=log_in.quantity,
                nutritional_basis=food.nutritional_basis,
                unit=log_in.unit,
                fiber_g=food.fiber_g,
                sugar_g=food.sugar_g,
                saturated_fat_g=food.saturated_fat_g,
                sodium_mg=food.sodium_mg,
                serving_quantity=food.serving_quantity,
            )

            snapshot = {
                "food_name": food.name,
                "food_brand": food.brand,
                **scaled,
            }
        else:
            # Custom log without catalogue food
            if not log_in.food_name or log_in.calories_kcal is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Either food_id or food_name and calories_kcal must be provided.",
                )
            snapshot = {
                "food_name": log_in.food_name,
                "food_brand": log_in.food_brand,
                "calories_kcal": round(log_in.calories_kcal, 1),
                "protein_g": round(log_in.protein_g or 0.0, 1),
                "carbs_g": round(log_in.carbs_g or 0.0, 1),
                "fat_g": round(log_in.fat_g or 0.0, 1),
                "fiber_g": round(log_in.fiber_g, 1) if log_in.fiber_g is not None else None,
                "sugar_g": round(log_in.sugar_g, 1) if log_in.sugar_g is not None else None,
                "saturated_fat_g": round(log_in.saturated_fat_g, 1) if log_in.saturated_fat_g is not None else None,
                "sodium_mg": round(log_in.sodium_mg, 1) if log_in.sodium_mg is not None else None,
            }

        return meal_log_repository.create(
            db=db,
            user_profile_id=profile.id,
            food_id=log_in.food_id,
            logged_date=log_in.logged_date,
            meal_category=log_in.meal_category,
            quantity=log_in.quantity,
            unit=log_in.unit,
            snapshot=snapshot,
            notes=log_in.notes,
        )

    def get_meal_log(self, db: Session, log_id: int) -> MealLog:
        log = meal_log_repository.get_by_id(db, log_id)
        if not log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Meal log with id {log_id} not found.",
            )
        return log

    def update_meal_log(
        self, db: Session, log_id: int, log_in: MealLogUpdate
    ) -> MealLog:
        log = self.get_meal_log(db, log_id)
        update_dict = log_in.model_dump(exclude_unset=True)

        new_quantity = update_dict.get("quantity", log.quantity)
        new_unit = update_dict.get("unit", log.unit)

        # If quantity or unit changed, re-scale nutritional snapshot
        if ("quantity" in update_dict and update_dict["quantity"] != log.quantity) or (
            "unit" in update_dict and update_dict["unit"] != log.unit
        ):
            if log.food_id:
                food = food_repository.get_by_id(db, log.food_id)
                if food:
                    scaled = scale_food_nutrients(
                        calories_kcal=food.calories_kcal,
                        protein_g=food.protein_g,
                        carbs_g=food.carbs_g,
                        fat_g=food.fat_g,
                        quantity=new_quantity,
                        nutritional_basis=food.nutritional_basis,
                        unit=new_unit,
                        fiber_g=food.fiber_g,
                        sugar_g=food.sugar_g,
                        saturated_fat_g=food.saturated_fat_g,
                        sodium_mg=food.sodium_mg,
                        serving_quantity=food.serving_quantity,
                    )
                    update_dict.update(scaled)
            elif log.quantity > 0:
                # Proportional scaling for custom items without catalog food
                ratio = new_quantity / log.quantity
                update_dict["calories_kcal"] = round(log.calories_kcal * ratio, 1)
                update_dict["protein_g"] = round(log.protein_g * ratio, 1)
                update_dict["carbs_g"] = round(log.carbs_g * ratio, 1)
                update_dict["fat_g"] = round(log.fat_g * ratio, 1)
                if log.fiber_g is not None:
                    update_dict["fiber_g"] = round(log.fiber_g * ratio, 1)
                if log.sugar_g is not None:
                    update_dict["sugar_g"] = round(log.sugar_g * ratio, 1)
                if log.saturated_fat_g is not None:
                    update_dict["saturated_fat_g"] = round(log.saturated_fat_g * ratio, 1)
                if log.sodium_mg is not None:
                    update_dict["sodium_mg"] = round(log.sodium_mg * ratio, 1)

        return meal_log_repository.update(db, log, update_dict)

    def delete_meal_log(self, db: Session, log_id: int) -> None:
        log = self.get_meal_log(db, log_id)
        meal_log_repository.delete(db, log)

    def get_daily_summary(
        self, db: Session, target_date: date
    ) -> DailyNutritionSummary:
        profile = profile_repository.get_current_profile(db)
        by_category: Dict[str, List[MealLogResponse]] = {
            "breakfast": [],
            "lunch": [],
            "dinner": [],
            "snacks": [],
        }

        if not profile:
            return DailyNutritionSummary(
                logged_date=target_date,
                totals=DailyMacroTotals(),
                by_category=by_category,
                total_entries=0,
            )

        logs = meal_log_repository.list_by_date(db, profile.id, target_date)
        for log in logs:
            cat = log.meal_category.lower()
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(MealLogResponse.model_validate(log))

        total_cal = round(sum(l.calories_kcal for l in logs), 1)
        total_pro = round(sum(l.protein_g for l in logs), 1)
        total_carb = round(sum(l.carbs_g for l in logs), 1)
        total_fat = round(sum(l.fat_g for l in logs), 1)

        fibers = [l.fiber_g for l in logs if l.fiber_g is not None]
        total_fiber = round(sum(fibers), 1) if fibers else None

        sugars = [l.sugar_g for l in logs if l.sugar_g is not None]
        total_sugar = round(sum(sugars), 1) if sugars else None

        sat_fats = [l.saturated_fat_g for l in logs if l.saturated_fat_g is not None]
        total_sat_fat = round(sum(sat_fats), 1) if sat_fats else None

        sodiums = [l.sodium_mg for l in logs if l.sodium_mg is not None]
        total_sodium = round(sum(sodiums), 1) if sodiums else None

        totals = DailyMacroTotals(
            calories_kcal=total_cal,
            protein_g=total_pro,
            carbs_g=total_carb,
            fat_g=total_fat,
            fiber_g=total_fiber,
            sugar_g=total_sugar,
            saturated_fat_g=total_sat_fat,
            sodium_mg=total_sodium,
        )

        return DailyNutritionSummary(
            logged_date=target_date,
            totals=totals,
            by_category=by_category,
            total_entries=len(logs),
        )

    def get_recent_foods(self, db: Session, limit: int = 10) -> List[FoodResponse]:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            return []
        foods = meal_log_repository.get_recent_foods(db, profile.id, limit=limit)
        return [FoodResponse.model_validate(f) for f in foods]


meal_log_service = MealLogService()

