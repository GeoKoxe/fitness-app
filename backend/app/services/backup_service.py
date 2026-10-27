import logging
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.exercise import Exercise
from app.models.food import Food
from app.models.meal_log import MealLog
from app.models.meal_plan import (
    DislikedFood,
    MealPlan,
    MealPlannerPreferences,
    PlannedMeal,
    PlannedMealItem,
)
from app.models.measurement import BodyMeasurement
from app.models.profile import UserProfile
from app.models.recipe import Recipe, RecipeIngredient
from app.models.training_profile import SavedTrainingProfile, TrainingProfile
from app.models.workout_log import (
    LoggedExercise,
    LoggedExerciseSet,
    WorkoutSessionLog,
)
from app.models.workout_plan import (
    PlannedExercise,
    PlannedWorkoutSession,
    WorkoutPlan,
)
from app.repositories.food_repository import food_repository
from app.repositories.meal_log_repository import meal_log_repository
from app.repositories.nutrition_goal_repository import nutrition_goal_repository
from app.repositories.profile_repository import profile_repository
from app.repositories.recipe_repository import recipe_repository
from app.schemas.backup import (
    BackupImportResult,
    NutritionBackupData,
    NutritionExportData,
    SystemBackupV2,
    TrainingBackupData,
)
from app.schemas.exercise import ExerciseResponse, slugify
from app.schemas.food import FoodResponse
from app.schemas.meal_log import MealLogResponse
from app.schemas.meal_plan import (
    DislikedFoodResponse,
    PlannerPreferencesResponse,
)
from app.schemas.measurement import BodyMeasurementResponse
from app.schemas.nutrition_goal import NutritionGoalResponse, NutritionGoalUpdate
from app.schemas.profile import UserProfileResponse
from app.schemas.recipe import RecipeResponse
from app.schemas.training_profile import (
    SavedTrainingProfileResponse,
    TrainingProfileResponse,
    join_tokens,
)
from app.schemas.workout_log import WorkoutSessionLogResponse
from app.schemas.workout_plan import WorkoutPlanResponse
from app.services.meal_planner_service import meal_planner_service
from app.services.recipe_service import recipe_service

logger = logging.getLogger(__name__)


def parse_dt(val: Any) -> Optional[datetime]:
    """Parse string or datetime into UTC datetime object."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        val_clean = val.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(val_clean)
        except Exception:
            return None
    return None


def parse_date(val: Any) -> Optional[date]:
    """Parse string, datetime, or date into date object."""
    if val is None:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        try:
            return date.fromisoformat(val[:10])
        except Exception:
            return None
    return None


class BackupService:
    def export_nutrition_data(self, db: Session) -> NutritionExportData:
        """Export legacy nutrition-only backup (version 1.2) for backward compatibility."""
        profile = profile_repository.get_current_profile(db)
        user_profile_id = profile.id if profile else 0

        foods = food_repository.list_foods(db, skip=0, limit=10000)
        meal_logs = (
            meal_log_repository.list_logs(db, user_profile_id=user_profile_id, skip=0, limit=50000)
            if user_profile_id
            else []
        )
        goal = (
            nutrition_goal_repository.get_by_profile_id(db, user_profile_id)
            if user_profile_id
            else None
        )
        goals_resp = NutritionGoalResponse.model_validate(goal) if goal else None

        recipes = recipe_repository.get_all(db, user_profile_id=user_profile_id, include_built_in=True)
        recipe_responses = [recipe_service.to_response(r) for r in recipes]

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

        pref = (
            db.query(MealPlannerPreferences)
            .filter(MealPlannerPreferences.user_profile_id == user_profile_id)
            .first()
            if user_profile_id
            else None
        )
        pref_resp = PlannerPreferencesResponse.model_validate(pref) if pref else None

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

    def export_system_backup(self, db: Session) -> SystemBackupV2:
        """Export comprehensive version 2.0 system backup covering all application data."""
        profile = profile_repository.get_current_profile(db)
        user_profile_id = profile.id if profile else 0
        profile_resp = UserProfileResponse.model_validate(profile) if profile else None

        # 1. Measurements
        measurements = (
            db.query(BodyMeasurement)
            .filter(BodyMeasurement.user_profile_id == user_profile_id)
            .order_by(BodyMeasurement.measured_at.asc())
            .all()
            if user_profile_id
            else []
        )
        measurements_resp = [BodyMeasurementResponse.model_validate(m) for m in measurements]

        # 2. Nutrition domain
        foods = food_repository.list_foods(db, skip=0, limit=50000)
        meal_logs = (
            meal_log_repository.list_logs(db, user_profile_id=user_profile_id, skip=0, limit=50000)
            if user_profile_id
            else []
        )
        goal = (
            nutrition_goal_repository.get_by_profile_id(db, user_profile_id)
            if user_profile_id
            else None
        )
        goals_resp = NutritionGoalResponse.model_validate(goal) if goal else None

        recipes = recipe_repository.get_all(db, user_profile_id=user_profile_id, include_built_in=True)
        recipe_responses = [recipe_service.to_response(r) for r in recipes]

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

        pref = (
            db.query(MealPlannerPreferences)
            .filter(MealPlannerPreferences.user_profile_id == user_profile_id)
            .first()
            if user_profile_id
            else None
        )
        pref_resp = PlannerPreferencesResponse.model_validate(pref) if pref else None

        disliked_foods = (
            meal_planner_service.get_disliked_foods(db, user_profile_id)
            if user_profile_id
            else []
        )

        nutrition_data = NutritionBackupData(
            foods=[FoodResponse.model_validate(f) for f in foods],
            meal_logs=[MealLogResponse.model_validate(l) for l in meal_logs],
            nutrition_goals=goals_resp,
            recipes=recipe_responses,
            meal_plans=plan_responses,
            planner_preferences=pref_resp,
            disliked_foods=disliked_foods,
        )

        # 3. Training domain
        custom_exercises = (
            db.query(Exercise)
            .filter(Exercise.is_built_in.is_(False), Exercise.user_profile_id == user_profile_id)
            .order_by(Exercise.name.asc())
            .all()
            if user_profile_id
            else []
        )
        custom_exercises_resp = [ExerciseResponse.model_validate(e) for e in custom_exercises]

        tp = (
            db.query(TrainingProfile)
            .filter(TrainingProfile.user_profile_id == user_profile_id)
            .first()
            if user_profile_id
            else None
        )
        tp_resp = TrainingProfileResponse.model_validate(tp) if tp else None

        saved_tps = (
            db.query(SavedTrainingProfile)
            .filter(SavedTrainingProfile.user_profile_id == user_profile_id)
            .order_by(SavedTrainingProfile.name.asc())
            .all()
            if user_profile_id
            else []
        )
        saved_tps_resp = [SavedTrainingProfileResponse.model_validate(s) for s in saved_tps]

        workout_plans = (
            db.query(WorkoutPlan)
            .options(
                joinedload(WorkoutPlan.sessions).joinedload(PlannedWorkoutSession.exercises)
            )
            .filter(WorkoutPlan.user_profile_id == user_profile_id)
            .order_by(WorkoutPlan.start_date.asc(), WorkoutPlan.id.asc())
            .all()
            if user_profile_id
            else []
        )
        workout_plans_resp = [WorkoutPlanResponse.model_validate(p) for p in workout_plans]

        session_logs = (
            db.query(WorkoutSessionLog)
            .options(
                joinedload(WorkoutSessionLog.exercises).joinedload(LoggedExercise.sets)
            )
            .filter(WorkoutSessionLog.user_profile_id == user_profile_id)
            .order_by(WorkoutSessionLog.started_at.asc(), WorkoutSessionLog.id.asc())
            .all()
            if user_profile_id
            else []
        )
        session_logs_resp = [WorkoutSessionLogResponse.model_validate(l) for l in session_logs]

        training_data = TrainingBackupData(
            custom_exercises=custom_exercises_resp,
            training_profile=tp_resp,
            saved_training_profiles=saved_tps_resp,
            workout_plans=workout_plans_resp,
            workout_session_logs=session_logs_resp,
        )

        return SystemBackupV2(
            format="fitpulse_backup",
            version="2.0",
            exported_at=datetime.now(timezone.utc),
            app_version="0.1.0",
            profile=profile_resp,
            body_measurements=measurements_resp,
            nutrition=nutrition_data,
            training=training_data,
        )

    def import_nutrition_data(self, db: Session, data: Any) -> BackupImportResult:
        """Alias for import_backup for backward compatibility with existing nutrition import callers."""
        return self.import_backup(db, data)

    def import_backup(self, db: Session, raw_data: Any) -> BackupImportResult:
        """Restore all application data with foreign-key preservation, transaction safety, and idempotency."""
        # Normalize input to dictionary
        if isinstance(raw_data, BaseModel):
            data_dict = raw_data.model_dump()
        elif isinstance(raw_data, dict):
            data_dict = raw_data
        else:
            return BackupImportResult(
                success=False,
                message="Invalid backup payload: expected a JSON object.",
            )

        version = str(data_dict.get("version", "")).strip()
        fmt = str(data_dict.get("format", "")).strip()

        if not version and not fmt:
            return BackupImportResult(
                success=False,
                message="Invalid backup payload: missing version identifier.",
            )

        if version.startswith("1."):
            is_legacy = True
        elif version == "2.0" or fmt == "fitpulse_backup" or version.startswith("2."):
            is_legacy = False
        else:
            return BackupImportResult(
                success=False,
                message=f"Unsupported backup schema version: '{version}'. Expected 1.x or 2.0.",
            )

        # Counter trackers
        imported_profile = False
        imported_measurements = 0
        imported_foods = 0
        imported_meal_logs = 0
        imported_goals = False
        imported_recipes = 0
        imported_meal_plans = 0
        imported_disliked = 0
        imported_custom_exercises = 0
        imported_training_profile = False
        imported_saved_training_profiles = 0
        imported_workout_plans = 0
        imported_workout_sessions = 0
        skipped_duplicates = 0

        # Mapping dictionaries for primary keys and foreign keys across entities
        food_id_map: Dict[int, int] = {}
        recipe_id_map: Dict[int, int] = {}
        exercise_id_map: Dict[int, int] = {}
        workout_plan_id_map: Dict[int, int] = {}
        planned_session_id_map: Dict[int, int] = {}
        planned_exercise_id_map: Dict[int, int] = {}

        # In-memory sets to catch duplicate natural keys within a single backup file
        seen_measurements: Set[Tuple[int, datetime]] = set()
        seen_meal_logs: Set[Tuple[int, Optional[date], Optional[str], str, float, str]] = set()
        seen_disliked: Set[Tuple[int, str]] = set()
        seen_saved_tps: Set[Tuple[int, str]] = set()
        seen_workout_plans: Set[Tuple[int, Optional[date], Optional[date], str]] = set()
        seen_session_logs: Set[Tuple[int, Optional[datetime], str]] = set()

        try:
            # 1. Profile Resolution (Explicit merge policy: keep destination profile authoritative)
            profile = profile_repository.get_current_profile(db)
            profile_data = data_dict.get("profile")

            if not profile:
                if profile_data and isinstance(profile_data, dict):
                    dob = parse_date(profile_data.get("date_of_birth"))
                    profile = UserProfile(
                        name=profile_data.get("name", "User"),
                        date_of_birth=dob,
                        sex=profile_data.get("sex"),
                        height_cm=profile_data.get("height_cm"),
                        activity_level=profile_data.get("activity_level"),
                    )
                    db.add(profile)
                    db.flush()
                    imported_profile = True
                else:
                    return BackupImportResult(
                        success=False,
                        message="User profile not found. Please create a user profile before restoring nutrition data.",
                    )

            # 2. Body Measurements
            measurements_list = data_dict.get("body_measurements") or []
            for m in measurements_list:
                m_dt = parse_dt(m.get("measured_at"))
                if not m_dt:
                    continue

                meas_key = (profile.id, m_dt)
                if meas_key in seen_measurements:
                    skipped_duplicates += 1
                    continue

                existing_m = (
                    db.query(BodyMeasurement)
                    .filter(
                        BodyMeasurement.user_profile_id == profile.id,
                        BodyMeasurement.measured_at == m_dt,
                    )
                    .first()
                )
                if existing_m:
                    seen_measurements.add(meas_key)
                    skipped_duplicates += 1
                else:
                    new_m = BodyMeasurement(
                        user_profile_id=profile.id,
                        measured_at=m_dt,
                        source=m.get("source", "manual"),
                        notes=m.get("notes"),
                        weight_kg=m.get("weight_kg"),
                        height_cm=m.get("height_cm"),
                        bmi=m.get("bmi"),
                        bmi_calculated=bool(m.get("bmi_calculated", False)),
                        body_fat_percentage=m.get("body_fat_percentage"),
                        fat_mass_kg=m.get("fat_mass_kg"),
                        muscle_mass_kg=m.get("muscle_mass_kg"),
                        skeletal_muscle_mass_kg=m.get("skeletal_muscle_mass_kg"),
                        body_water_percentage=m.get("body_water_percentage"),
                        body_water_mass_kg=m.get("body_water_mass_kg"),
                        bone_mineral_content_kg=m.get("bone_mineral_content_kg"),
                        visceral_fat_level=m.get("visceral_fat_level"),
                        basal_metabolic_rate_kcal=m.get("basal_metabolic_rate_kcal"),
                        heart_rate_bpm=m.get("heart_rate_bpm"),
                        waist_circumference_cm=m.get("waist_circumference_cm"),
                        hip_circumference_cm=m.get("hip_circumference_cm"),
                        chest_circumference_cm=m.get("chest_circumference_cm"),
                        arms_circumference_cm=m.get("arms_circumference_cm"),
                        thighs_circumference_cm=m.get("thighs_circumference_cm"),
                        neck_circumference_cm=m.get("neck_circumference_cm"),
                    )
                    db.add(new_m)
                    db.flush()
                    seen_measurements.add(meas_key)
                    imported_measurements += 1

            # 3. Nutrition Domain
            nutrition_section = data_dict.get("nutrition") if isinstance(data_dict.get("nutrition"), dict) else {}
            foods_list = nutrition_section.get("foods") or data_dict.get("foods") or []

            # 3a. Foods
            for f_in in foods_list:
                existing = None
                barcode = f_in.get("barcode")
                ext_id = f_in.get("external_id")
                food_name = (f_in.get("name") or "").strip()
                brand = (f_in.get("brand") or "").strip() if f_in.get("brand") else None

                if barcode:
                    existing = food_repository.get_by_barcode(db, barcode)
                if not existing and ext_id:
                    existing = food_repository.get_by_external_id(db, ext_id)
                if not existing and food_name:
                    q = db.query(Food).filter(func.lower(Food.name) == food_name.lower())
                    if brand:
                        existing = q.filter(func.lower(Food.brand) == brand.lower()).first()
                    else:
                        existing = q.filter((Food.brand.is_(None)) | (Food.brand == "")).first()

                old_id = f_in.get("id")
                if existing:
                    if old_id is not None:
                        food_id_map[old_id] = existing.id
                    skipped_duplicates += 1
                else:
                    new_food = Food(
                        name=f_in.get("name", "Unknown Food"),
                        brand=f_in.get("brand"),
                        category=f_in.get("category"),
                        source=f_in.get("source", "custom"),
                        external_id=f_in.get("external_id"),
                        barcode=f_in.get("barcode"),
                        nutritional_basis=f_in.get("nutritional_basis", "100g"),
                        serving_description=f_in.get("serving_description"),
                        serving_quantity=f_in.get("serving_quantity"),
                        serving_unit=f_in.get("serving_unit"),
                        calories_kcal=f_in.get("calories_kcal", 0.0),
                        protein_g=f_in.get("protein_g", 0.0),
                        carbs_g=f_in.get("carbs_g", 0.0),
                        fat_g=f_in.get("fat_g", 0.0),
                        fiber_g=f_in.get("fiber_g"),
                        sugar_g=f_in.get("sugar_g"),
                        saturated_fat_g=f_in.get("saturated_fat_g"),
                        sodium_mg=f_in.get("sodium_mg"),
                        is_favorite=bool(f_in.get("is_favorite", False)),
                    )
                    db.add(new_food)
                    db.flush()
                    if old_id is not None:
                        food_id_map[old_id] = new_food.id
                    imported_foods += 1

            # 3b. Meal Logs
            meal_logs_list = nutrition_section.get("meal_logs") or data_dict.get("meal_logs") or []
            for l_in in meal_logs_list:
                log_d = parse_date(l_in.get("logged_date"))
                cat = l_in.get("meal_category")
                f_name = (l_in.get("food_name") or "").strip()
                qty = float(l_in.get("quantity") or 0.0)
                u = (l_in.get("unit") or "g").strip()

                log_key = (profile.id, log_d, cat, f_name.lower(), qty, u)
                if log_key in seen_meal_logs:
                    skipped_duplicates += 1
                    continue

                existing_log = (
                    db.query(MealLog)
                    .filter(
                        MealLog.user_profile_id == profile.id,
                        MealLog.logged_date == log_d,
                        MealLog.meal_category == cat,
                        func.lower(MealLog.food_name) == f_name.lower(),
                        MealLog.quantity == qty,
                        MealLog.unit == u,
                    )
                    .first()
                )
                if existing_log:
                    seen_meal_logs.add(log_key)
                    skipped_duplicates += 1
                else:
                    raw_fid = l_in.get("food_id")
                    remapped_food_id = food_id_map.get(raw_fid) if raw_fid is not None else None

                    # If not remapped by ID, attempt lookup by food_name in DB
                    if remapped_food_id is None and f_name:
                        matched_food = db.query(Food).filter(func.lower(Food.name) == f_name.lower()).first()
                        if matched_food:
                            remapped_food_id = matched_food.id

                    new_log = MealLog(
                        user_profile_id=profile.id,
                        food_id=remapped_food_id,
                        logged_date=log_d,
                        meal_category=cat,
                        quantity=qty,
                        unit=u,
                        food_name=l_in.get("food_name"),
                        food_brand=l_in.get("food_brand"),
                        calories_kcal=l_in.get("calories_kcal", 0.0),
                        protein_g=l_in.get("protein_g", 0.0),
                        carbs_g=l_in.get("carbs_g", 0.0),
                        fat_g=l_in.get("fat_g", 0.0),
                        fiber_g=l_in.get("fiber_g"),
                        sugar_g=l_in.get("sugar_g"),
                        saturated_fat_g=l_in.get("saturated_fat_g"),
                        sodium_mg=l_in.get("sodium_mg"),
                        notes=l_in.get("notes"),
                    )
                    db.add(new_log)
                    db.flush()
                    seen_meal_logs.add(log_key)
                    imported_meal_logs += 1

            # 3c. Nutrition Goals
            goals_in = nutrition_section.get("nutrition_goals") or data_dict.get("nutrition_goals")
            if goals_in and isinstance(goals_in, dict):
                nutrition_goal_repository.save_or_update(
                    db,
                    profile.id,
                    NutritionGoalUpdate(
                        calories_kcal=goals_in.get("calories_kcal"),
                        protein_g=goals_in.get("protein_g"),
                        carbs_g=goals_in.get("carbs_g"),
                        fat_g=goals_in.get("fat_g"),
                        fiber_g=goals_in.get("fiber_g"),
                    ),
                )
                imported_goals = True

            # 3d. Recipes & Recipe Ingredients
            recipes_list = nutrition_section.get("recipes") or data_dict.get("recipes") or []
            for r_in in recipes_list:
                r_name = (r_in.get("name") or "").strip()
                is_built_in = bool(r_in.get("is_built_in", False))
                old_rid = r_in.get("id")

                if is_built_in:
                    existing_recipe = (
                        db.query(Recipe)
                        .filter(
                            func.lower(Recipe.name) == r_name.lower(),
                            Recipe.is_built_in.is_(True),
                        )
                        .first()
                    )
                else:
                    existing_recipe = (
                        db.query(Recipe)
                        .filter(
                            Recipe.user_profile_id == profile.id,
                            func.lower(Recipe.name) == r_name.lower(),
                        )
                        .first()
                    )

                if existing_recipe:
                    if old_rid is not None:
                        recipe_id_map[old_rid] = existing_recipe.id
                    skipped_duplicates += 1
                else:
                    new_recipe = Recipe(
                        user_profile_id=profile.id,
                        name=r_name,
                        description=r_in.get("description"),
                        meal_category=r_in.get("meal_category", "dinner"),
                        servings=r_in.get("servings", 1),
                        prep_time_minutes=r_in.get("prep_time_minutes", 0),
                        cook_time_minutes=r_in.get("cook_time_minutes", 0),
                        instructions=r_in.get("instructions"),
                        tags=r_in.get("tags"),
                        is_built_in=False,
                    )
                    db.add(new_recipe)
                    db.flush()
                    if old_rid is not None:
                        recipe_id_map[old_rid] = new_recipe.id

                    for ing in r_in.get("ingredients") or []:
                        raw_fid = ing.get("food_id")
                        remapped_fid = food_id_map.get(raw_fid)

                        # Safe fallback: lookup by ingredient food_name snapshot or destination DB food
                        if not remapped_fid and ing.get("food_name"):
                            f_match = db.query(Food).filter(func.lower(Food.name) == ing["food_name"].strip().lower()).first()
                            if f_match:
                                remapped_fid = f_match.id

                        if not remapped_fid and raw_fid is not None:
                            # Verify if raw_fid exists in destination DB
                            existing_dest_food = db.query(Food).filter(Food.id == raw_fid).first()
                            if existing_dest_food:
                                remapped_fid = existing_dest_food.id

                        if not remapped_fid:
                            raise ValueError(
                                f"Cannot resolve food reference for recipe '{r_name}' ingredient: food_id={raw_fid}, name={ing.get('food_name')}"
                            )

                        db.add(
                            RecipeIngredient(
                                recipe_id=new_recipe.id,
                                food_id=remapped_fid,
                                quantity=ing.get("quantity", 0.0),
                                unit=ing.get("unit", "g"),
                                preparation_notes=ing.get("preparation_notes"),
                            )
                        )
                    db.flush()
                    imported_recipes += 1

            # 3e. Meal Plans
            plans_list = nutrition_section.get("meal_plans") or data_dict.get("meal_plans") or []
            for p_in in plans_list:
                p_name = (p_in.get("name") or "").strip()
                s_date = parse_date(p_in.get("start_date"))
                e_date = parse_date(p_in.get("end_date"))
                old_pid = p_in.get("id")

                plan_key = (profile.id, s_date, e_date, p_name.lower())
                if plan_key in seen_workout_plans:
                    skipped_duplicates += 1
                    continue

                existing_plan = (
                    db.query(MealPlan)
                    .filter(
                        MealPlan.user_profile_id == profile.id,
                        MealPlan.start_date == s_date,
                        MealPlan.end_date == e_date,
                        func.lower(MealPlan.name) == p_name.lower(),
                    )
                    .first()
                )
                if existing_plan:
                    seen_workout_plans.add(plan_key)
                    skipped_duplicates += 1
                else:
                    new_plan = MealPlan(
                        user_profile_id=profile.id,
                        name=p_name,
                        start_date=s_date,
                        end_date=e_date,
                        is_active=bool(p_in.get("is_active", True)),
                        target_tolerance_pct=float(p_in.get("target_tolerance_pct") or 10.0),
                        notes=p_in.get("notes"),
                    )
                    db.add(new_plan)
                    db.flush()
                    seen_workout_plans.add(plan_key)

                    for day in p_in.get("days") or []:
                        for m in day.get("meals") or []:
                            raw_rid = m.get("recipe_id")
                            remapped_rid = recipe_id_map.get(raw_rid) if raw_rid else None
                            if not remapped_rid and raw_rid and m.get("name"):
                                r_match = db.query(Recipe).filter(func.lower(Recipe.name) == m["name"].strip().lower()).first()
                                if r_match:
                                    remapped_rid = r_match.id

                            pm = PlannedMeal(
                                meal_plan_id=new_plan.id,
                                plan_date=parse_date(m.get("plan_date")),
                                day_number=m.get("day_number", 1),
                                meal_category=m.get("meal_category", "breakfast"),
                                recipe_id=remapped_rid,
                                name=m.get("name", "Planned Meal"),
                                servings=m.get("servings", 1),
                                calories_kcal=m.get("calories_kcal", 0.0),
                                protein_g=m.get("protein_g", 0.0),
                                carbs_g=m.get("carbs_g", 0.0),
                                fat_g=m.get("fat_g", 0.0),
                                fiber_g=m.get("fiber_g"),
                                notes=m.get("notes"),
                            )
                            db.add(pm)
                            db.flush()

                            for it in m.get("items") or []:
                                raw_fid = it.get("food_id")
                                rf_id = food_id_map.get(raw_fid) if raw_fid else None
                                if not rf_id and raw_fid:
                                    # Verify if food exists in destination DB
                                    dest_f = db.query(Food).filter(Food.id == raw_fid).first()
                                    if dest_f:
                                        rf_id = dest_f.id

                                db.add(
                                    PlannedMealItem(
                                        planned_meal_id=pm.id,
                                        food_id=rf_id,
                                        quantity=it.get("quantity", 0.0),
                                        unit=it.get("unit", "g"),
                                        calories_kcal=it.get("calories_kcal", 0.0),
                                        protein_g=it.get("protein_g", 0.0),
                                        carbs_g=it.get("carbs_g", 0.0),
                                        fat_g=it.get("fat_g", 0.0),
                                        fiber_g=it.get("fiber_g"),
                                    )
                                )

                    db.flush()
                    meal_planner_service.regenerate_shopping_list(db, new_plan.id)
                    imported_meal_plans += 1

            # 3f. Preferences
            pref_in = nutrition_section.get("planner_preferences") or data_dict.get("planner_preferences")
            if pref_in and isinstance(pref_in, dict):
                pref = (
                    db.query(MealPlannerPreferences)
                    .filter(MealPlannerPreferences.user_profile_id == profile.id)
                    .first()
                )
                if not pref:
                    pref = MealPlannerPreferences(user_profile_id=profile.id)
                    db.add(pref)
                pref.enabled_categories = pref_in.get("enabled_categories")
                pref.disliked_foods = pref_in.get("disliked_foods")
                pref.max_cooking_time_minutes = pref_in.get("max_cooking_time_minutes")
                pref.simplicity_preference = pref_in.get("simplicity_preference", "balanced")
                pref.daily_budget = pref_in.get("daily_budget")
                pref.reuse_ingredients = bool(pref_in.get("reuse_ingredients", False))
                if pref_in.get("target_tolerance_pct") is not None:
                    pref.target_tolerance_pct = float(pref_in["target_tolerance_pct"])

            # 3g. Disliked Foods
            disliked_list = nutrition_section.get("disliked_foods") or data_dict.get("disliked_foods") or []
            for df_in in disliked_list:
                df_name = (df_in.get("food_name") or "").strip()
                df_key = (profile.id, df_name.lower())
                if df_key in seen_disliked:
                    skipped_duplicates += 1
                    continue

                existing_df = (
                    db.query(DislikedFood)
                    .filter(
                        DislikedFood.user_profile_id == profile.id,
                        func.lower(DislikedFood.food_name) == df_name.lower(),
                    )
                    .first()
                )
                if existing_df:
                    seen_disliked.add(df_key)
                    skipped_duplicates += 1
                else:
                    raw_fid = df_in.get("food_id")
                    remapped_fid = food_id_map.get(raw_fid) if raw_fid else None
                    if not remapped_fid and df_name:
                        matched_f = db.query(Food).filter(func.lower(Food.name) == df_name.lower()).first()
                        if matched_f:
                            remapped_fid = matched_f.id

                    new_df = DislikedFood(
                        user_profile_id=profile.id,
                        food_id=remapped_fid,
                        food_name=df_name,
                    )
                    db.add(new_df)
                    db.flush()
                    seen_disliked.add(df_key)
                    imported_disliked += 1

            # 4. Training Domain (v2.0)
            training_section = data_dict.get("training") if isinstance(data_dict.get("training"), dict) else {}

            # 4a. Custom Exercises
            exercises_list = training_section.get("custom_exercises") or []
            for ex_in in exercises_list:
                old_eid = ex_in.get("id")
                slug = (ex_in.get("slug") or "").strip()
                ex_name = (ex_in.get("name") or "").strip()

                existing_ex = None
                if slug:
                    existing_ex = db.query(Exercise).filter(Exercise.slug == slug).first()
                if not existing_ex and ex_name:
                    existing_ex = db.query(Exercise).filter(func.lower(Exercise.name) == ex_name.lower()).first()

                if existing_ex:
                    if old_eid is not None:
                        exercise_id_map[old_eid] = existing_ex.id
                    skipped_duplicates += 1
                else:
                    clean_slug = slug or slugify(ex_name)
                    new_ex = Exercise(
                        slug=clean_slug,
                        name=ex_name,
                        movement_category=ex_in.get("movement_category", "other"),
                        primary_muscle=ex_in.get("primary_muscle", "full_body"),
                        secondary_muscles=ex_in.get("secondary_muscles"),
                        equipment_required=ex_in.get("equipment_required", "bodyweight"),
                        difficulty_level=ex_in.get("difficulty_level", "beginner"),
                        instructions=ex_in.get("instructions"),
                        alternative_exercise_slugs=ex_in.get("alternative_exercise_slugs"),
                        is_built_in=False,
                        user_profile_id=profile.id,
                    )
                    db.add(new_ex)
                    db.flush()
                    if old_eid is not None:
                        exercise_id_map[old_eid] = new_ex.id
                    imported_custom_exercises += 1

            # 4b. Training Profile
            tp_in = training_section.get("training_profile")
            if tp_in and isinstance(tp_in, dict):
                tp = (
                    db.query(TrainingProfile)
                    .filter(TrainingProfile.user_profile_id == profile.id)
                    .first()
                )
                if not tp:
                    tp = TrainingProfile(user_profile_id=profile.id)
                    db.add(tp)
                tp.experience_level = tp_in.get("experience_level", "beginner")
                tp.training_goals = join_tokens(tp_in.get("training_goals", "general_fitness"))
                tp.available_days = join_tokens(tp_in.get("available_days", "monday,wednesday,friday"))
                tp.preferred_duration_minutes = int(tp_in.get("preferred_duration_minutes", 60))
                tp.available_equipment = join_tokens(tp_in.get("available_equipment", "bodyweight,dumbbell"))
                tp.excluded_exercises = join_tokens(tp_in.get("excluded_exercises", ""))
                tp.excluded_muscle_groups = join_tokens(tp_in.get("excluded_muscle_groups", ""))
                tp.training_considerations = tp_in.get("training_considerations")
                imported_training_profile = True

            # 4c. Saved Training Profiles
            saved_tp_list = training_section.get("saved_training_profiles") or []
            for stp_in in saved_tp_list:
                s_name = (stp_in.get("name") or "").strip()
                stp_key = (profile.id, s_name.lower())
                if stp_key in seen_saved_tps:
                    skipped_duplicates += 1
                    continue

                existing_stp = (
                    db.query(SavedTrainingProfile)
                    .filter(
                        SavedTrainingProfile.user_profile_id == profile.id,
                        func.lower(SavedTrainingProfile.name) == s_name.lower(),
                    )
                    .first()
                )
                if existing_stp:
                    seen_saved_tps.add(stp_key)
                    skipped_duplicates += 1
                else:
                    new_stp = SavedTrainingProfile(
                        user_profile_id=profile.id,
                        name=s_name,
                        experience_level=stp_in.get("experience_level", "beginner"),
                        training_goals=join_tokens(stp_in.get("training_goals", "general_fitness")),
                        available_days=join_tokens(stp_in.get("available_days", "monday,wednesday,friday")),
                        preferred_duration_minutes=int(stp_in.get("preferred_duration_minutes", 60)),
                        available_equipment=join_tokens(stp_in.get("available_equipment", "bodyweight,dumbbell")),
                        excluded_exercises=join_tokens(stp_in.get("excluded_exercises", "")),
                        excluded_muscle_groups=join_tokens(stp_in.get("excluded_muscle_groups", "")),
                        training_considerations=stp_in.get("training_considerations"),
                    )
                    db.add(new_stp)
                    db.flush()
                    seen_saved_tps.add(stp_key)
                    imported_saved_training_profiles += 1

            # 4d. Workout Plans & Planned Sessions
            workout_plans_list = training_section.get("workout_plans") or []
            for wp_in in workout_plans_list:
                wp_name = (wp_in.get("name") or "").strip()
                s_date = parse_date(wp_in.get("start_date"))
                e_date = parse_date(wp_in.get("end_date"))
                old_wpid = wp_in.get("id")

                wp_key = (profile.id, s_date, e_date, wp_name.lower())
                if wp_key in seen_workout_plans:
                    skipped_duplicates += 1
                    continue

                existing_wp = (
                    db.query(WorkoutPlan)
                    .filter(
                        WorkoutPlan.user_profile_id == profile.id,
                        WorkoutPlan.start_date == s_date,
                        WorkoutPlan.end_date == e_date,
                        func.lower(WorkoutPlan.name) == wp_name.lower(),
                    )
                    .first()
                )

                if existing_wp:
                    seen_workout_plans.add(wp_key)
                    if old_wpid is not None:
                        workout_plan_id_map[old_wpid] = existing_wp.id
                    # Map existing sessions and exercises so execution logs referencing them can resolve
                    for es in existing_wp.sessions:
                        for bs in wp_in.get("sessions") or []:
                            if (
                                bs.get("day_of_week_index") == es.day_of_week_index
                                and (bs.get("session_name") or "").strip().lower() == es.session_name.strip().lower()
                            ):
                                if bs.get("id") is not None:
                                    planned_session_id_map[bs["id"]] = es.id
                                for epe in es.exercises:
                                    for bpe in bs.get("exercises") or []:
                                        if (
                                            bpe.get("order_in_session") == epe.order_in_session
                                            and bpe.get("exercise_slug") == epe.exercise_slug
                                        ):
                                            if bpe.get("id") is not None:
                                                planned_exercise_id_map[bpe["id"]] = epe.id
                    skipped_duplicates += 1
                else:
                    new_wp = WorkoutPlan(
                        user_profile_id=profile.id,
                        name=wp_name,
                        split_type=wp_in.get("split_type", "full_body"),
                        start_date=s_date,
                        end_date=e_date,
                        is_active=bool(wp_in.get("is_active", True)),
                        generation_settings=wp_in.get("generation_settings"),
                        notes=wp_in.get("notes"),
                    )
                    db.add(new_wp)
                    db.flush()
                    seen_workout_plans.add(wp_key)
                    if old_wpid is not None:
                        workout_plan_id_map[old_wpid] = new_wp.id

                    for sess in wp_in.get("sessions") or []:
                        old_sid = sess.get("id")
                        new_sess = PlannedWorkoutSession(
                            workout_plan_id=new_wp.id,
                            day_of_week_index=sess.get("day_of_week_index", 0),
                            day_of_week_name=sess.get("day_of_week_name", "Monday"),
                            plan_date=parse_date(sess.get("plan_date")),
                            is_rest_day=bool(sess.get("is_rest_day", False)),
                            session_name=sess.get("session_name", "Session"),
                            session_focus=sess.get("session_focus", "General"),
                            estimated_duration_minutes=sess.get("estimated_duration_minutes", 0),
                            warmup_notes=sess.get("warmup_notes"),
                            cooldown_notes=sess.get("cooldown_notes"),
                        )
                        db.add(new_sess)
                        db.flush()
                        if old_sid is not None:
                            planned_session_id_map[old_sid] = new_sess.id

                        for pex in sess.get("exercises") or []:
                            old_peid = pex.get("id")
                            raw_eid = pex.get("exercise_id")
                            remapped_eid = exercise_id_map.get(raw_eid) if raw_eid else None
                            if not remapped_eid and pex.get("exercise_slug"):
                                db_ex = db.query(Exercise).filter(Exercise.slug == pex["exercise_slug"]).first()
                                remapped_eid = db_ex.id if db_ex else None

                            new_pe = PlannedExercise(
                                planned_session_id=new_sess.id,
                                exercise_id=remapped_eid,
                                order_in_session=pex.get("order_in_session", 1),
                                exercise_slug=pex.get("exercise_slug", ""),
                                exercise_name=pex.get("exercise_name", ""),
                                primary_muscle=pex.get("primary_muscle", ""),
                                secondary_muscles=pex.get("secondary_muscles"),
                                movement_category=pex.get("movement_category", ""),
                                equipment_required=pex.get("equipment_required", ""),
                                target_sets=pex.get("target_sets", 3),
                                target_reps=str(pex.get("target_reps", "8-12")),
                                rest_seconds=pex.get("rest_seconds", 90),
                                progression_notes=pex.get("progression_notes"),
                                warmup_guidance=pex.get("warmup_guidance"),
                            )
                            db.add(new_pe)
                            db.flush()
                            if old_peid is not None:
                                planned_exercise_id_map[old_peid] = new_pe.id

                    imported_workout_plans += 1

            # 4e. Workout Session Logs
            session_logs_list = training_section.get("workout_session_logs") or []
            for slog in session_logs_list:
                s_name = (slog.get("session_name") or "").strip()
                started_at = parse_dt(slog.get("started_at"))
                slog_key = (profile.id, started_at, s_name.lower())

                if slog_key in seen_session_logs:
                    skipped_duplicates += 1
                    continue

                existing_slog = (
                    db.query(WorkoutSessionLog)
                    .filter(
                        WorkoutSessionLog.user_profile_id == profile.id,
                        WorkoutSessionLog.started_at == started_at,
                        func.lower(WorkoutSessionLog.session_name) == s_name.lower(),
                    )
                    .first()
                )

                if existing_slog:
                    seen_session_logs.add(slog_key)
                    skipped_duplicates += 1
                else:
                    raw_wpid = slog.get("workout_plan_id")
                    remapped_wpid = workout_plan_id_map.get(raw_wpid) if raw_wpid else None
                    raw_psid = slog.get("planned_session_id")
                    remapped_psid = planned_session_id_map.get(raw_psid) if raw_psid else None

                    # Parse and validate session version (Batch 4: preserve version on restore)
                    raw_version = slog.get("version")
                    if raw_version is None:
                        session_version = 1
                    else:
                        if isinstance(raw_version, bool):
                            raise ValueError(
                                f"Invalid version '{raw_version}' for workout session '{s_name}': expected a positive integer."
                            )
                        if isinstance(raw_version, int):
                            session_version = raw_version
                        elif isinstance(raw_version, float) and raw_version.is_integer():
                            session_version = int(raw_version)
                        elif isinstance(raw_version, str) and raw_version.strip().isdigit():
                            session_version = int(raw_version.strip())
                        else:
                            raise ValueError(
                                f"Invalid version '{raw_version}' for workout session '{s_name}': expected a positive integer."
                            )

                        if session_version < 1:
                            raise ValueError(
                                f"Invalid version '{raw_version}' for workout session '{s_name}': expected a positive integer >= 1."
                            )

                    new_slog = WorkoutSessionLog(
                        user_profile_id=profile.id,
                        workout_plan_id=remapped_wpid,
                        planned_session_id=remapped_psid,
                        session_name=s_name,
                        session_focus=slog.get("session_focus"),
                        status=slog.get("status", "completed"),
                        started_at=started_at,
                        completed_at=parse_dt(slog.get("completed_at")),
                        duration_seconds=int(slog.get("duration_seconds", 0)),
                        notes=slog.get("notes"),
                        version=session_version,
                    )
                    db.add(new_slog)
                    db.flush()
                    seen_session_logs.add(slog_key)

                    for lex in slog.get("exercises") or []:
                        raw_eid = lex.get("exercise_id")
                        remapped_eid = exercise_id_map.get(raw_eid) if raw_eid else None
                        if not remapped_eid and lex.get("exercise_slug"):
                            db_ex = db.query(Exercise).filter(Exercise.slug == lex["exercise_slug"]).first()
                            remapped_eid = db_ex.id if db_ex else None

                        raw_peid = lex.get("planned_exercise_id")
                        remapped_peid = planned_exercise_id_map.get(raw_peid) if raw_peid else None

                        new_lex = LoggedExercise(
                            session_log_id=new_slog.id,
                            exercise_id=remapped_eid,
                            planned_exercise_id=remapped_peid,
                            order_in_session=lex.get("order_in_session", 1),
                            exercise_slug=lex.get("exercise_slug", ""),
                            exercise_name=lex.get("exercise_name", ""),
                            primary_muscle=lex.get("primary_muscle", ""),
                            equipment_required=lex.get("equipment_required", ""),
                            movement_category=lex.get("movement_category", ""),
                            target_sets=lex.get("target_sets"),
                            target_reps=str(lex["target_reps"]) if lex.get("target_reps") is not None else None,
                            rest_seconds=lex.get("rest_seconds"),
                            notes=lex.get("notes"),
                        )
                        db.add(new_lex)
                        db.flush()

                        for s in lex.get("sets") or []:
                            new_set = LoggedExerciseSet(
                                logged_exercise_id=new_lex.id,
                                set_number=int(s.get("set_number", 1)),
                                weight_kg=s.get("weight_kg"),
                                reps=s.get("reps"),
                                is_completed=bool(s.get("is_completed", False)),
                                is_skipped=bool(s.get("is_skipped", False)),
                                notes=s.get("notes"),
                                completed_at=parse_dt(s.get("completed_at")),
                            )
                            db.add(new_set)
                        db.flush()

                    imported_workout_sessions += 1

            # Commit the entire atomic transaction
            db.commit()

            # Format descriptive summary message
            parts = []
            if imported_profile:
                parts.append("user profile")
            if imported_measurements > 0:
                parts.append(f"{imported_measurements} measurements")
            if imported_foods > 0:
                parts.append(f"{imported_foods} foods")
            if imported_meal_logs > 0:
                parts.append(f"{imported_meal_logs} meal logs")
            if imported_goals:
                parts.append("nutrition goals")
            if imported_recipes > 0:
                parts.append(f"{imported_recipes} recipes")
            if imported_meal_plans > 0:
                parts.append(f"{imported_meal_plans} meal plans")
            if imported_disliked > 0:
                parts.append(f"{imported_disliked} disliked foods")
            if imported_custom_exercises > 0:
                parts.append(f"{imported_custom_exercises} custom exercises")
            if imported_training_profile:
                parts.append("training profile")
            if imported_saved_training_profiles > 0:
                parts.append(f"{imported_saved_training_profiles} saved routines")
            if imported_workout_plans > 0:
                parts.append(f"{imported_workout_plans} workout plans")
            if imported_workout_sessions > 0:
                parts.append(f"{imported_workout_sessions} workout session logs")

            restored_str = ", ".join(parts) if parts else "0 new records"
            dup_str = f" ({skipped_duplicates} duplicate records skipped)" if skipped_duplicates > 0 else ""
            msg = f"Successfully restored {restored_str}{dup_str}."

            return BackupImportResult(
                success=True,
                imported_profile=imported_profile,
                imported_measurements=imported_measurements,
                imported_foods=imported_foods,
                imported_meal_logs=imported_meal_logs,
                imported_goals=imported_goals,
                imported_recipes=imported_recipes,
                imported_meal_plans=imported_meal_plans,
                imported_disliked_foods=imported_disliked,
                imported_custom_exercises=imported_custom_exercises,
                imported_training_profile=imported_training_profile,
                imported_saved_training_profiles=imported_saved_training_profiles,
                imported_workout_plans=imported_workout_plans,
                imported_workout_sessions=imported_workout_sessions,
                skipped_duplicates=skipped_duplicates,
                message=msg,
            )

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to restore backup: {e}", exc_info=True)
            return BackupImportResult(
                success=False,
                imported_profile=False,
                imported_measurements=0,
                imported_foods=0,
                imported_meal_logs=0,
                imported_goals=False,
                imported_recipes=0,
                imported_meal_plans=0,
                imported_disliked_foods=0,
                imported_custom_exercises=0,
                imported_training_profile=False,
                imported_saved_training_profiles=0,
                imported_workout_plans=0,
                imported_workout_sessions=0,
                skipped_duplicates=0,
                message=f"Import failed due to error: {str(e)}",
            )


backup_service = BackupService()
