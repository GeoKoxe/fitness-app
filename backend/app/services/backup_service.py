import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.food import Food
from app.models.meal_log import MealLog
from app.models.meal_plan import (
    DislikedFood,
    MealPlan,
    MealPlannerPreferences,
    PlannedMeal,
    PlannedMealItem,
    ShoppingListItem,
)
from app.models.recipe import Recipe, RecipeIngredient
from app.repositories.food_repository import food_repository
from app.repositories.meal_log_repository import meal_log_repository
from app.repositories.nutrition_goal_repository import nutrition_goal_repository
from app.repositories.profile_repository import profile_repository
from app.repositories.recipe_repository import recipe_repository
from app.schemas.backup import NutritionExportData, NutritionImportResult
from app.schemas.food import FoodResponse
from app.schemas.meal_log import MealLogResponse
from app.schemas.meal_plan import PlannerPreferencesResponse
from app.schemas.nutrition_goal import NutritionGoalResponse, NutritionGoalUpdate
from app.services.meal_planner_service import meal_planner_service
from app.services.recipe_service import recipe_service

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

        # Export recipes (custom recipes for this profile + built-in)
        recipes = recipe_repository.get_all(db, user_profile_id=user_profile_id, include_built_in=True)
        recipe_responses = [recipe_service.to_response(r) for r in recipes]

        # Export meal plans
        meal_plans = (
            db.query(MealPlan)
            .filter(MealPlan.user_profile_id == user_profile_id)
            .order_by(MealPlan.created_at.desc())
            .all()
            if user_profile_id
            else []
        )
        plan_responses = [
            meal_planner_service.to_response(db, p, user_profile_id) for p in meal_plans
        ]

        # Export preferences
        pref = (
            db.query(MealPlannerPreferences)
            .filter(MealPlannerPreferences.user_profile_id == user_profile_id)
            .first()
            if user_profile_id
            else None
        )
        pref_resp = PlannerPreferencesResponse.model_validate(pref) if pref else None

        # Export persistent disliked foods
        disliked_foods = (
            meal_planner_service.get_disliked_foods(db, user_profile_id)
            if user_profile_id
            else []
        )

        return NutritionExportData(
            version="1.2",
            exported_at=datetime.now(timezone.utc),
            foods=[FoodResponse.model_validate(f) for f in foods],
            meal_logs=[MealLogResponse.model_validate(l) for l in meal_logs],
            nutrition_goals=goals_resp,
            recipes=recipe_responses,
            meal_plans=plan_responses,
            planner_preferences=pref_resp,
            disliked_foods=disliked_foods,
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
                imported_recipes=0,
                imported_meal_plans=0,
                message=f"Unsupported backup schema version: '{data.version}'. Expected 1.x.",
            )

        profile = profile_repository.get_current_profile(db)
        if not profile:
            return NutritionImportResult(
                success=False,
                imported_foods=0,
                imported_meal_logs=0,
                imported_goals=False,
                imported_recipes=0,
                imported_meal_plans=0,
                message="User profile not found. Please create a user profile before restoring nutrition data.",
            )

        imported_foods_count = 0
        imported_logs_count = 0
        imported_goals_flag = False
        imported_recipes_count = 0
        imported_plans_count = 0

        try:
            # 1. Map old food id -> new/existing food id
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

            # 2. Restore Meal Logs
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

            # 3. Restore nutrition goals if present in backup
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

            # 4. Restore custom recipes (v1.2+)
            recipe_id_map = {}
            for r_in in (data.recipes or []):
                # If built-in recipe already exists, map to existing ID
                if r_in.is_built_in:
                    existing_recipe = (
                        db.query(Recipe)
                        .filter(Recipe.name == r_in.name, Recipe.is_built_in.is_(True))
                        .first()
                    )
                    if existing_recipe:
                        recipe_id_map[r_in.id] = existing_recipe.id
                        continue

                new_recipe = Recipe(
                    user_profile_id=profile.id,
                    name=r_in.name,
                    description=r_in.description,
                    meal_category=r_in.meal_category,
                    servings=r_in.servings,
                    prep_time_minutes=r_in.prep_time_minutes,
                    cook_time_minutes=r_in.cook_time_minutes,
                    instructions=r_in.instructions,
                    tags=r_in.tags,
                    is_built_in=False,
                )
                db.add(new_recipe)
                db.flush()
                recipe_id_map[r_in.id] = new_recipe.id

                for ing in r_in.ingredients:
                    remapped_food_id = food_id_map.get(ing.food_id, ing.food_id)
                    db.add(
                        RecipeIngredient(
                            recipe_id=new_recipe.id,
                            food_id=remapped_food_id,
                            quantity=ing.quantity,
                            unit=ing.unit,
                            preparation_notes=ing.preparation_notes,
                        )
                    )
                imported_recipes_count += 1

            # 5. Restore meal plans (v1.2+)
            for p_in in (data.meal_plans or []):
                new_plan = MealPlan(
                    user_profile_id=profile.id,
                    name=p_in.name,
                    start_date=p_in.start_date,
                    end_date=p_in.end_date,
                    is_active=p_in.is_active,
                    target_tolerance_pct=getattr(p_in, "target_tolerance_pct", 10.0) or 10.0,
                    notes=p_in.notes,
                )
                db.add(new_plan)
                db.flush()

                for day in p_in.days:
                    for m in day.meals:
                        remapped_r_id = recipe_id_map.get(m.recipe_id, m.recipe_id) if m.recipe_id else None
                        pm = PlannedMeal(
                            meal_plan_id=new_plan.id,
                            plan_date=m.plan_date,
                            day_number=m.day_number,
                            meal_category=m.meal_category,
                            recipe_id=remapped_r_id,
                            name=m.name,
                            servings=m.servings,
                            calories_kcal=m.calories_kcal,
                            protein_g=m.protein_g,
                            carbs_g=m.carbs_g,
                            fat_g=m.fat_g,
                            fiber_g=m.fiber_g,
                            notes=m.notes,
                        )
                        db.add(pm)
                        db.flush()

                        for it in m.items:
                            rf_id = food_id_map.get(it.food_id, it.food_id) if it.food_id else None
                            db.add(
                                PlannedMealItem(
                                    planned_meal_id=pm.id,
                                    food_id=rf_id,
                                    quantity=it.quantity,
                                    unit=it.unit,
                                    calories_kcal=it.calories_kcal,
                                    protein_g=it.protein_g,
                                    carbs_g=it.carbs_g,
                                    fat_g=it.fat_g,
                                    fiber_g=it.fiber_g,
                                )
                            )

                meal_planner_service.regenerate_shopping_list(db, new_plan.id)
                imported_plans_count += 1

            # 6. Restore preferences (v1.2+)
            if data.planner_preferences:
                pref = (
                    db.query(MealPlannerPreferences)
                    .filter(MealPlannerPreferences.user_profile_id == profile.id)
                    .first()
                )
                if not pref:
                    pref = MealPlannerPreferences(user_profile_id=profile.id)
                    db.add(pref)
                pref.enabled_categories = data.planner_preferences.enabled_categories
                pref.disliked_foods = data.planner_preferences.disliked_foods
                pref.max_cooking_time_minutes = data.planner_preferences.max_cooking_time_minutes
                pref.simplicity_preference = data.planner_preferences.simplicity_preference
                pref.daily_budget = data.planner_preferences.daily_budget
                pref.reuse_ingredients = data.planner_preferences.reuse_ingredients
                if data.planner_preferences.target_tolerance_pct is not None:
                    pref.target_tolerance_pct = data.planner_preferences.target_tolerance_pct

            # 7. Restore disliked foods (v1.2+)
            imported_disliked_count = 0
            for df_in in (data.disliked_foods or []):
                remapped_food_id = food_id_map.get(df_in.food_id, df_in.food_id) if df_in.food_id else None
                # Check if already present to avoid duplicates
                existing_df = (
                    db.query(DislikedFood)
                    .filter(
                        DislikedFood.user_profile_id == profile.id,
                        DislikedFood.food_name.ilike(df_in.food_name),
                    )
                    .first()
                )
                if not existing_df:
                    db.add(
                        DislikedFood(
                            user_profile_id=profile.id,
                            food_id=remapped_food_id,
                            food_name=df_in.food_name,
                        )
                    )
                    imported_disliked_count += 1

            db.commit()

            extra_parts = []
            if imported_goals_flag:
                extra_parts.append("goals")
            if imported_recipes_count > 0:
                extra_parts.append(f"{imported_recipes_count} recipes")
            if imported_plans_count > 0:
                extra_parts.append(f"{imported_plans_count} meal plans")
            if imported_disliked_count > 0:
                extra_parts.append(f"{imported_disliked_count} disliked foods")
            extra_msg = f", plus {', '.join(extra_parts)}" if extra_parts else ""

            return NutritionImportResult(
                success=True,
                imported_foods=imported_foods_count,
                imported_meal_logs=imported_logs_count,
                imported_goals=imported_goals_flag,
                imported_recipes=imported_recipes_count,
                imported_meal_plans=imported_plans_count,
                imported_disliked_foods=imported_disliked_count,
                message=f"Successfully restored {imported_foods_count} foods, {imported_logs_count} meal logs{extra_msg}.",
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to import nutrition data: {e}", exc_info=True)
            return NutritionImportResult(
                success=False,
                imported_foods=0,
                imported_meal_logs=0,
                imported_goals=False,
                imported_recipes=0,
                imported_meal_plans=0,
                message=f"Import failed due to error: {str(e)}",
            )


backup_service = BackupService()
