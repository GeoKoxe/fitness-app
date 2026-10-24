import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.food import Food
from app.models.meal_log import MealLog
from app.repositories.food_repository import food_repository
from app.repositories.meal_log_repository import meal_log_repository
from app.repositories.nutrition_goal_repository import nutrition_goal_repository
from app.repositories.profile_repository import profile_repository
from app.schemas.backup import NutritionExportData, NutritionImportResult
from app.schemas.food import FoodResponse
from app.schemas.meal_log import MealLogResponse
from app.schemas.nutrition_goal import NutritionGoalResponse, NutritionGoalUpdate

logger = logging.getLogger(__name__)


class BackupService:
    def export_nutrition_data(self, db: Session) -> NutritionExportData:
        profile = profile_repository.get_current_profile(db)
        user_profile_id = profile.id if profile else 0

        # Export all foods in local catalogue
        foods = food_repository.list_foods(db, skip=0, limit=10000)
        # Export all meal logs for current profile
        meal_logs = (
            meal_log_repository.list_logs(db, user_profile_id=user_profile_id, skip=0, limit=50000)
            if user_profile_id
            else []
        )
        # Export nutrition goals
        goal = (
            nutrition_goal_repository.get_by_profile_id(db, user_profile_id)
            if user_profile_id
            else None
        )
        goals_resp = NutritionGoalResponse.model_validate(goal) if goal else None

        return NutritionExportData(
            version="1.1",
            exported_at=datetime.now(timezone.utc),
            foods=[FoodResponse.model_validate(f) for f in foods],
            meal_logs=[MealLogResponse.model_validate(l) for l in meal_logs],
            nutrition_goals=goals_resp,
        )

    def import_nutrition_data(
        self, db: Session, data: NutritionExportData
    ) -> NutritionImportResult:
        if not data.version or not data.version.startswith("1."):
            return NutritionImportResult(
                success=False,
                imported_foods=0,
                imported_meal_logs=0,
                imported_goals=False,
                message=f"Unsupported backup schema version: '{data.version}'. Expected 1.x.",
            )

        profile = profile_repository.get_current_profile(db)
        if not profile:
            return NutritionImportResult(
                success=False,
                imported_foods=0,
                imported_meal_logs=0,
                imported_goals=False,
                message="User profile not found. Please create a user profile before restoring nutrition data.",
            )

        imported_foods_count = 0
        imported_logs_count = 0
        imported_goals_flag = False

        try:
            # Map old food id -> new/existing food id
            food_id_map = {}

            for f_in in data.foods:
                existing = None
                if f_in.barcode:
                    existing = food_repository.get_by_barcode(db, f_in.barcode)
                if not existing and f_in.external_id:
                    existing = food_repository.get_by_external_id(db, f_in.external_id)

                if existing:
                    food_id_map[f_in.id] = existing.id
                else:
                    new_food = Food(
                        name=f_in.name,
                        brand=f_in.brand,
                        category=f_in.category,
                        source=f_in.source,
                        external_id=f_in.external_id,
                        barcode=f_in.barcode,
                        nutritional_basis=f_in.nutritional_basis,
                        serving_description=f_in.serving_description,
                        serving_quantity=f_in.serving_quantity,
                        serving_unit=f_in.serving_unit,
                        calories_kcal=f_in.calories_kcal,
                        protein_g=f_in.protein_g,
                        carbs_g=f_in.carbs_g,
                        fat_g=f_in.fat_g,
                        fiber_g=f_in.fiber_g,
                        sugar_g=f_in.sugar_g,
                        saturated_fat_g=f_in.saturated_fat_g,
                        sodium_mg=f_in.sodium_mg,
                        is_favorite=f_in.is_favorite,
                    )
                    db.add(new_food)
                    db.flush()
                    food_id_map[f_in.id] = new_food.id
                    imported_foods_count += 1

            for l_in in data.meal_logs:
                new_food_id = food_id_map.get(l_in.food_id) if l_in.food_id else None

                new_log = MealLog(
                    user_profile_id=profile.id,
                    food_id=new_food_id,
                    logged_date=l_in.logged_date,
                    meal_category=l_in.meal_category,
                    quantity=l_in.quantity,
                    unit=l_in.unit,
                    food_name=l_in.food_name,
                    food_brand=l_in.food_brand,
                    calories_kcal=l_in.calories_kcal,
                    protein_g=l_in.protein_g,
                    carbs_g=l_in.carbs_g,
                    fat_g=l_in.fat_g,
                    fiber_g=l_in.fiber_g,
                    sugar_g=l_in.sugar_g,
                    saturated_fat_g=l_in.saturated_fat_g,
                    sodium_mg=l_in.sodium_mg,
                    notes=l_in.notes,
                )
                db.add(new_log)
                imported_logs_count += 1

            # Restore nutrition goals if present in backup
            if data.nutrition_goals:
                nutrition_goal_repository.save_or_update(
                    db,
                    profile.id,
                    NutritionGoalUpdate(
                        calories_kcal=data.nutrition_goals.calories_kcal,
                        protein_g=data.nutrition_goals.protein_g,
                        carbs_g=data.nutrition_goals.carbs_g,
                        fat_g=data.nutrition_goals.fat_g,
                        fiber_g=data.nutrition_goals.fiber_g,
                    ),
                )
                imported_goals_flag = True

            db.commit()
            goal_msg = " and nutrition goals" if imported_goals_flag else ""
            return NutritionImportResult(
                success=True,
                imported_foods=imported_foods_count,
                imported_meal_logs=imported_logs_count,
                imported_goals=imported_goals_flag,
                message=f"Successfully restored {imported_foods_count} foods, {imported_logs_count} meal logs{goal_msg}.",
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to import nutrition data: {e}", exc_info=True)
            return NutritionImportResult(
                success=False,
                imported_foods=0,
                imported_meal_logs=0,
                imported_goals=False,
                message=f"Import failed due to error: {str(e)}",
            )


backup_service = BackupService()
