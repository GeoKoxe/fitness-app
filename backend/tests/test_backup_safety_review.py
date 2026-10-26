from datetime import date, datetime, timezone
import pytest
from sqlalchemy import create_engine, event, func, text
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.exercise import Exercise
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
from app.services.backup_service import backup_service


def create_isolated_sqlite_session():
    """Create a completely isolated in-memory SQLite database with PRAGMA foreign_keys=ON."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return engine, TestingSession


# =============================================================================
# Review 1 — Existing record conflicts
# =============================================================================

def test_review1_same_primary_key_same_content():
    """Review 1.1: Same primary key, same content -> matched, preserved, no duplicates."""
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        prof = UserProfile(name="Alex", height_cm=175.0)
        db.add(prof)
        db.flush()

        food = Food(
            id=1,
            name="Rolled Oats",
            brand="Nature Valley",
            barcode="0123456789",
            calories_kcal=380.0,
            protein_g=13.0,
            carbs_g=68.0,
            fat_g=7.0,
        )
        db.add(food)
        db.commit()

        backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "nutrition": {
                "foods": [
                    {
                        "id": 1,
                        "name": "Rolled Oats",
                        "brand": "Nature Valley",
                        "barcode": "0123456789",
                        "calories_kcal": 380.0,
                        "protein_g": 13.0,
                        "carbs_g": 68.0,
                        "fat_g": 7.0,
                    }
                ]
            },
        }

        result = backup_service.import_backup(db, backup)
        assert result.success is True
        assert result.imported_foods == 0
        assert result.skipped_duplicates == 1
        assert db.query(Food).count() == 1
        assert db.query(Food).first().name == "Rolled Oats"


def test_review1_same_primary_key_different_content():
    """Review 1.2: Same primary key, different content -> destination record NEVER overwritten; new food gets new ID."""
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        prof = UserProfile(name="Alex", height_cm=175.0)
        db.add(prof)
        db.flush()

        # Destination DB has Food ID=1: "Chicken Breast"
        dest_food = Food(
            id=1,
            name="Chicken Breast",
            brand="Farm Fresh",
            barcode="999999",
            calories_kcal=165.0,
            protein_g=31.0,
            carbs_g=0.0,
            fat_g=3.6,
        )
        db.add(dest_food)
        db.commit()

        # Backup has Food ID=1: "Peanut Butter" (completely different)
        backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "nutrition": {
                "foods": [
                    {
                        "id": 1,
                        "name": "Peanut Butter",
                        "brand": "Natural Choice",
                        "barcode": "111111",
                        "calories_kcal": 588.0,
                        "protein_g": 25.0,
                        "carbs_g": 20.0,
                        "fat_g": 50.0,
                    }
                ],
                "meal_logs": [
                    {
                        "food_id": 1,  # In backup, refers to Peanut Butter
                        "logged_date": "2026-10-25",
                        "meal_category": "snacks",
                        "quantity": 32.0,
                        "unit": "g",
                        "food_name": "Peanut Butter",
                        "calories_kcal": 188.0,
                        "protein_g": 8.0,
                        "carbs_g": 6.0,
                        "fat_g": 16.0,
                    }
                ],
            },
        }

        result = backup_service.import_backup(db, backup)
        assert result.success is True
        assert result.imported_foods == 1
        assert result.imported_meal_logs == 1

        # Check that Food ID=1 was NOT overwritten and remains "Chicken Breast"
        food_1 = db.query(Food).filter(Food.id == 1).first()
        assert food_1.name == "Chicken Breast"

        # Check that Peanut Butter was inserted with a new ID (e.g. ID=2)
        peanut_butter = db.query(Food).filter(Food.name == "Peanut Butter").first()
        assert peanut_butter is not None
        assert peanut_butter.id != 1

        # Check that the imported meal log points to Peanut Butter (NOT Chicken Breast ID=1!)
        imported_log = db.query(MealLog).first()
        assert imported_log.food_id == peanut_butter.id
        assert imported_log.food_name == "Peanut Butter"


def test_review1_same_natural_key_different_primary_key():
    """Review 1.3: Same natural key, different primary key -> correctly deduplicates and remaps child references."""
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        prof = UserProfile(name="Alex", height_cm=175.0)
        db.add(prof)
        db.flush()

        # Destination DB has Whey Protein under ID=10
        dest_food = Food(
            id=10,
            name="Whey Isolate",
            brand="Optimum",
            barcode="777777",
            calories_kcal=120.0,
            protein_g=24.0,
            carbs_g=2.0,
            fat_g=1.0,
        )
        db.add(dest_food)
        db.commit()

        # Backup has Whey Isolate under ID=999
        backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "nutrition": {
                "foods": [
                    {
                        "id": 999,
                        "name": "Whey Isolate",
                        "brand": "Optimum",
                        "barcode": "777777",
                        "calories_kcal": 120.0,
                        "protein_g": 24.0,
                        "carbs_g": 2.0,
                        "fat_g": 1.0,
                    }
                ],
                "meal_logs": [
                    {
                        "food_id": 999,
                        "logged_date": "2026-10-25",
                        "meal_category": "snacks",
                        "quantity": 30.0,
                        "unit": "g",
                        "food_name": "Whey Isolate",
                        "calories_kcal": 120.0,
                        "protein_g": 24.0,
                        "carbs_g": 2.0,
                        "fat_g": 1.0,
                    }
                ],
            },
        }

        result = backup_service.import_backup(db, backup)
        assert result.success is True
        assert result.imported_foods == 0
        assert result.skipped_duplicates >= 1
        assert result.imported_meal_logs == 1

        # Food count must remain 1 (no duplicate food inserted)
        assert db.query(Food).count() == 1

        # Meal log food_id must be remapped from 999 to existing ID 10
        log = db.query(MealLog).first()
        assert log.food_id == 10


def test_review1_duplicate_records_within_single_backup():
    """Review 1.4: Duplicate records within a single backup file -> second record safely skipped without crash."""
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        prof = UserProfile(name="Alex", height_cm=175.0)
        db.add(prof)
        db.commit()

        backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "body_measurements": [
                {"measured_at": "2026-10-20T08:00:00Z", "weight_kg": 75.0},
                {"measured_at": "2026-10-20T08:00:00Z", "weight_kg": 75.0},  # Intra-backup duplicate
            ],
            "nutrition": {
                "foods": [
                    {"id": 1, "name": "Apple", "barcode": "123"},
                    {"id": 2, "name": "Apple", "barcode": "123"},  # Intra-backup duplicate
                ],
                "meal_logs": [
                    {
                        "food_id": 1,
                        "logged_date": "2026-10-20",
                        "meal_category": "lunch",
                        "quantity": 100.0,
                        "unit": "g",
                        "food_name": "Apple",
                        "calories_kcal": 52.0,
                        "protein_g": 0.3,
                        "carbs_g": 14.0,
                        "fat_g": 0.2,
                    },
                    {
                        "food_id": 2,
                        "logged_date": "2026-10-20",
                        "meal_category": "lunch",
                        "quantity": 100.0,
                        "unit": "g",
                        "food_name": "Apple",
                        "calories_kcal": 52.0,
                        "protein_g": 0.3,
                        "carbs_g": 14.0,
                        "fat_g": 0.2,
                    },  # Intra-backup duplicate
                ],
            },
            "training": {
                "saved_training_profiles": [
                    {"name": "PPL Routine", "experience_level": "intermediate"},
                    {"name": "PPL Routine", "experience_level": "intermediate"},  # Intra-backup duplicate
                ]
            },
        }

        result = backup_service.import_backup(db, backup)
        assert result.success is True
        assert result.imported_measurements == 1
        assert result.imported_foods == 1
        assert result.imported_meal_logs == 1
        assert result.imported_saved_training_profiles == 1
        assert result.skipped_duplicates >= 4

        # Verify only 1 of each was inserted
        assert db.query(BodyMeasurement).count() == 1
        assert db.query(Food).count() == 1
        assert db.query(MealLog).count() == 1
        assert db.query(SavedTrainingProfile).count() == 1


def test_review1_backup_belonging_to_different_profile():
    """Review 1.5: Backup belonging to a different profile -> existing profile preserved, all child records assigned to active profile."""
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        # Existing user is Alice (ID=1)
        alice = UserProfile(id=1, name="Alice", height_cm=165.0, sex="female")
        db.add(alice)
        db.commit()

        # Backup from Bob (ID=42)
        backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "profile": {
                "id": 42,
                "name": "Bob",
                "height_cm": 185.0,
                "sex": "male",
            },
            "body_measurements": [
                {"measured_at": "2026-10-21T07:00:00Z", "weight_kg": 85.0}
            ],
            "nutrition": {
                "meal_logs": [
                    {
                        "logged_date": "2026-10-21",
                        "meal_category": "dinner",
                        "quantity": 150.0,
                        "unit": "g",
                        "food_name": "Salmon",
                        "calories_kcal": 300.0,
                        "protein_g": 30.0,
                        "carbs_g": 0.0,
                        "fat_g": 18.0,
                    }
                ]
            },
        }

        result = backup_service.import_backup(db, backup)
        assert result.success is True

        # Existing profile MUST NOT be overwritten
        current_profile = db.query(UserProfile).first()
        assert current_profile.id == 1
        assert current_profile.name == "Alice"
        assert current_profile.height_cm == 165.0

        # All imported records MUST have user_profile_id = 1 (Alice), NEVER 42
        meas = db.query(BodyMeasurement).first()
        assert meas.user_profile_id == 1

        log = db.query(MealLog).first()
        assert log.user_profile_id == 1

        # Check PRAGMA foreign_key_check passes with 0 violations
        fk_check = db.execute(text("PRAGMA foreign_key_check;")).fetchall()
        assert len(fk_check) == 0


# =============================================================================
# Review 2 — Relationship remapping with colliding IDs
# =============================================================================

def test_review2_relationship_remapping_with_colliding_ids():
    """Review 2: Create DB with existing records (IDs 1, 2...), import backup with colliding IDs (IDs 1, 2...),
    verify that all foreign keys and snapshot fields point to the remapped records and foreign_key_check passes.
    """
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        # User profile
        prof = UserProfile(id=1, name="Charlie", height_cm=180.0)
        db.add(prof)
        db.flush()

        # Existing DB has Food 1 ("Existing Rice"), Recipe 1 ("Existing Stir Fry"), Exercise 1 ("Existing Squat")
        f1 = Food(id=1, name="Existing Rice", calories_kcal=130.0, protein_g=2.7, carbs_g=28.0, fat_g=0.3)
        db.add(f1)
        db.flush()

        r1 = Recipe(id=1, user_profile_id=1, name="Existing Stir Fry", instructions="Cook rice")
        db.add(r1)
        db.flush()

        ri1 = RecipeIngredient(recipe_id=1, food_id=1, quantity=100.0, unit="g")
        db.add(ri1)

        ex1 = Exercise(id=1, slug="existing_squat", name="Existing Squat", movement_category="squat", primary_muscle="quadriceps", equipment_required="bodyweight")
        db.add(ex1)

        mp1 = MealPlan(id=1, user_profile_id=1, name="Existing Meal Plan", start_date=date(2026, 1, 1), end_date=date(2026, 1, 7))
        db.add(mp1)
        db.flush()

        wp1 = WorkoutPlan(id=1, user_profile_id=1, name="Existing Plan", start_date=date(2026, 1, 1), end_date=date(2026, 1, 7))
        db.add(wp1)
        db.flush()

        ps1 = PlannedWorkoutSession(id=1, workout_plan_id=1, day_of_week_index=0, day_of_week_name="Monday", plan_date=date(2026, 1, 1), session_name="Existing Session", session_focus="General")
        db.add(ps1)
        db.flush()

        pe1 = PlannedExercise(id=1, planned_session_id=1, exercise_id=1, order_in_session=1, exercise_slug="existing_squat", exercise_name="Existing Squat", primary_muscle="quadriceps", movement_category="squat", equipment_required="bodyweight")
        db.add(pe1)

        slog1 = WorkoutSessionLog(id=1, user_profile_id=1, workout_plan_id=1, planned_session_id=1, session_name="Existing Log", started_at=datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc))
        db.add(slog1)
        db.flush()

        lex1 = LoggedExercise(id=1, session_log_id=1, exercise_id=1, planned_exercise_id=1, order_in_session=1, exercise_slug="existing_squat", exercise_name="Existing Squat", primary_muscle="quadriceps", equipment_required="bodyweight", movement_category="squat")
        db.add(lex1)
        db.flush()

        s1 = LoggedExerciseSet(id=1, logged_exercise_id=1, set_number=1, weight_kg=50.0, reps=10, is_completed=True)
        db.add(s1)
        db.commit()

        # --- NOW IMPORT BACKUP WITH COLLIDING IDS (1, 1, 1...) BUT COMPLETELY DIFFERENT DATA ---
        colliding_backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "nutrition": {
                "foods": [
                    {
                        "id": 1,  # Collides with Food ID 1 ("Existing Rice")
                        "name": "Imported Salmon",
                        "calories_kcal": 208.0,
                        "protein_g": 20.0,
                        "carbs_g": 0.0,
                        "fat_g": 13.0,
                    }
                ],
                "meal_logs": [
                    {
                        "id": 1,
                        "food_id": 1,  # MUST remap to new Salmon ID, NOT Existing Rice ID 1!
                        "logged_date": "2026-10-26",
                        "meal_category": "dinner",
                        "quantity": 180.0,
                        "unit": "g",
                        "food_name": "Imported Salmon",
                        "calories_kcal": 374.0,
                        "protein_g": 36.0,
                        "carbs_g": 0.0,
                        "fat_g": 23.4,
                    }
                ],
                "recipes": [
                    {
                        "id": 1,  # Collides with Recipe ID 1
                        "name": "Imported Baked Salmon",
                        "ingredients": [
                            {
                                "food_id": 1,  # In backup, refers to Imported Salmon
                                "food_name": "Imported Salmon",
                                "quantity": 180.0,
                                "unit": "g",
                            }
                        ],
                    }
                ],
                "meal_plans": [
                    {
                        "id": 1,
                        "name": "Imported Plan 2026",
                        "start_date": "2026-10-26",
                        "end_date": "2026-11-01",
                        "days": [
                            {
                                "day_number": 1,
                                "meals": [
                                    {
                                        "day_number": 1,
                                        "plan_date": "2026-10-26",
                                        "meal_category": "dinner",
                                        "recipe_id": 1,  # Refers to Imported Baked Salmon
                                        "name": "Imported Baked Salmon",
                                        "items": [
                                            {
                                                "food_id": 1,  # Refers to Imported Salmon
                                                "quantity": 180.0,
                                                "unit": "g",
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            },
            "training": {
                "custom_exercises": [
                    {
                        "id": 1,  # Collides with Exercise ID 1
                        "slug": "imported_bench_press",
                        "name": "Imported Bench Press",
                        "movement_category": "horizontal_push",
                        "primary_muscle": "chest",
                        "equipment_required": "barbell",
                    }
                ],
                "workout_plans": [
                    {
                        "id": 1,  # Collides with WorkoutPlan ID 1
                        "name": "Imported Workout Plan",
                        "start_date": "2026-10-26",
                        "end_date": "2026-11-01",
                        "sessions": [
                            {
                                "id": 1,  # Collides with PlannedSession ID 1
                                "day_of_week_index": 0,
                                "day_of_week_name": "Monday",
                                "plan_date": "2026-10-26",
                                "session_name": "Imported Chest Day",
                                "session_focus": "Hypertrophy",
                                "exercises": [
                                    {
                                        "id": 1,  # Collides with PlannedExercise ID 1
                                        "exercise_id": 1,  # Refers to Imported Bench Press
                                        "order_in_session": 1,
                                        "exercise_slug": "imported_bench_press",
                                        "exercise_name": "Imported Bench Press",
                                        "primary_muscle": "chest",
                                        "movement_category": "horizontal_push",
                                        "equipment_required": "barbell",
                                        "target_sets": 4,
                                        "target_reps": "8-10",
                                        "rest_seconds": 120,
                                    }
                                ],
                            }
                        ],
                    }
                ],
                "workout_session_logs": [
                    {
                        "id": 1,  # Collides with WorkoutSessionLog ID 1
                        "workout_plan_id": 1,  # Refers to Imported Workout Plan
                        "planned_session_id": 1,  # Refers to Imported Chest Day
                        "session_name": "Imported Execution Log",
                        "started_at": "2026-10-26T18:00:00Z",
                        "exercises": [
                            {
                                "id": 1,
                                "exercise_id": 1,  # Refers to Imported Bench Press
                                "planned_exercise_id": 1,  # Refers to Imported Planned Exercise
                                "order_in_session": 1,
                                "exercise_slug": "imported_bench_press",
                                "exercise_name": "Imported Bench Press",
                                "primary_muscle": "chest",
                                "equipment_required": "barbell",
                                "movement_category": "horizontal_push",
                                "sets": [
                                    {
                                        "id": 1,
                                        "set_number": 1,
                                        "weight_kg": 90.0,
                                        "reps": 8,
                                        "is_completed": True,
                                    }
                                ],
                            }
                        ],
                    }
                ],
            },
        }

        result = backup_service.import_backup(db, colliding_backup)
        assert result.success is True, f"Import failed: {result.message}"

        # 1. Verify PRAGMA foreign_key_check passes with ZERO violations
        fk_violations = db.execute(text("PRAGMA foreign_key_check;")).fetchall()
        assert len(fk_violations) == 0, f"Foreign key violations found: {fk_violations}"

        # 2. Check Food Remapping
        salmon = db.query(Food).filter(Food.name == "Imported Salmon").first()
        assert salmon.id != 1  # Got a newly allocated ID (e.g. 2)

        # Check MealLog references the newly allocated salmon ID
        m_log = db.query(MealLog).filter(MealLog.food_name == "Imported Salmon").first()
        assert m_log.food_id == salmon.id

        # Check RecipeIngredient references the newly allocated salmon ID
        r_ing = db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id != 1).first()
        assert r_ing.food_id == salmon.id

        # 3. Check Recipe Remapping
        baked_salmon = db.query(Recipe).filter(Recipe.name == "Imported Baked Salmon").first()
        assert baked_salmon.id != 1
        assert r_ing.recipe_id == baked_salmon.id

        # 4. Check Meal Plan & Planned Meals Remapping
        imp_plan = db.query(MealPlan).filter(MealPlan.name == "Imported Plan 2026").first()
        assert imp_plan.id != 1
        imp_pm = db.query(PlannedMeal).filter(PlannedMeal.meal_plan_id == imp_plan.id).first()
        assert imp_pm.recipe_id == baked_salmon.id
        imp_pmi = db.query(PlannedMealItem).filter(PlannedMealItem.planned_meal_id == imp_pm.id).first()
        assert imp_pmi.food_id == salmon.id

        # 5. Check Exercise Remapping
        bench_press = db.query(Exercise).filter(Exercise.slug == "imported_bench_press").first()
        assert bench_press.id != 1

        # 6. Check Workout Plan & Planned Session Remapping
        imp_wp = db.query(WorkoutPlan).filter(WorkoutPlan.name == "Imported Workout Plan").first()
        assert imp_wp.id != 1
        imp_sess = db.query(PlannedWorkoutSession).filter(PlannedWorkoutSession.workout_plan_id == imp_wp.id).first()
        assert imp_sess.id != 1
        imp_pe = db.query(PlannedExercise).filter(PlannedExercise.planned_session_id == imp_sess.id).first()
        assert imp_pe.exercise_id == bench_press.id
        assert imp_pe.exercise_slug == "imported_bench_press"

        # 7. Check Workout Session Log & Execution Remapping
        imp_slog = db.query(WorkoutSessionLog).filter(WorkoutSessionLog.session_name == "Imported Execution Log").first()
        assert imp_slog.id != 1
        assert imp_slog.workout_plan_id == imp_wp.id
        assert imp_slog.planned_session_id == imp_sess.id

        imp_lex = db.query(LoggedExercise).filter(LoggedExercise.session_log_id == imp_slog.id).first()
        assert imp_lex.exercise_id == bench_press.id
        assert imp_lex.planned_exercise_id == imp_pe.id
        assert imp_lex.exercise_slug == "imported_bench_press"

        imp_set = db.query(LoggedExerciseSet).filter(LoggedExerciseSet.logged_exercise_id == imp_lex.id).first()
        assert imp_set.weight_kg == 90.0
        assert imp_set.reps == 8
        assert imp_set.is_completed is True


# =============================================================================
# Review 3 — Existing profile and legacy import
# =============================================================================

def test_review3_legacy_import_preserves_unrelated_entities_and_is_idempotent():
    """Review 3: Legacy v1.x import only touches nutrition domain, leaving training, body measurements, and profile untouched."""
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        # Pre-existing profile, measurement, and training data
        prof = UserProfile(name="Dana White", height_cm=170.0, sex="female")
        db.add(prof)
        db.flush()

        meas = BodyMeasurement(user_profile_id=prof.id, measured_at=datetime(2026, 10, 1, 8, 0, tzinfo=timezone.utc), weight_kg=60.0)
        db.add(meas)

        tp = TrainingProfile(user_profile_id=prof.id, experience_level="advanced", training_goals="strength", available_days="monday,friday")
        db.add(tp)

        wp = WorkoutPlan(user_profile_id=prof.id, name="Dana Strength Plan", start_date=date(2026, 10, 1), end_date=date(2026, 10, 7))
        db.add(wp)
        db.commit()

        # Legacy v1.2 backup containing only nutrition data
        legacy_backup = {
            "version": "1.2",
            "foods": [
                {
                    "name": "Greek Yogurt",
                    "calories_kcal": 100.0,
                    "protein_g": 17.0,
                    "carbs_g": 6.0,
                    "fat_g": 0.7,
                }
            ],
            "meal_logs": [
                {
                    "logged_date": "2026-10-15",
                    "meal_category": "breakfast",
                    "quantity": 170.0,
                    "unit": "g",
                    "food_name": "Greek Yogurt",
                    "calories_kcal": 100.0,
                    "protein_g": 17.0,
                    "carbs_g": 6.0,
                    "fat_g": 0.7,
                }
            ],
        }

        # 1. First import
        res1 = backup_service.import_backup(db, legacy_backup)
        assert res1.success is True
        assert res1.imported_foods == 1
        assert res1.imported_meal_logs == 1

        # Verify training, measurements, and profile are completely intact
        p_check = db.query(UserProfile).first()
        assert p_check.name == "Dana White"
        assert p_check.height_cm == 170.0

        assert db.query(BodyMeasurement).count() == 1
        assert db.query(BodyMeasurement).first().weight_kg == 60.0

        assert db.query(TrainingProfile).count() == 1
        assert db.query(TrainingProfile).first().experience_level == "advanced"

        assert db.query(WorkoutPlan).count() == 1
        assert db.query(WorkoutPlan).first().name == "Dana Strength Plan"

        # 2. Repeated import (Idempotency test)
        res2 = backup_service.import_backup(db, legacy_backup)
        assert res2.success is True
        assert res2.imported_foods == 0
        assert res2.imported_meal_logs == 0
        assert res2.skipped_duplicates >= 2

        # Verify no duplicate records created
        assert db.query(Food).count() == 1
        assert db.query(MealLog).count() == 1


# =============================================================================
# Review 4 — Shopping-list and meal-plan preservation
# =============================================================================

def test_review4_shopping_list_regeneration_and_meal_plan_fidelity():
    """Review 4: Restoring a meal plan regenerates equivalent persistent shopping list items without altering plan fidelity."""
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        prof = UserProfile(name="Chef Gourmet", height_cm=178.0)
        db.add(prof)
        db.flush()

        food1 = Food(name="Whole Wheat Pasta", category="Pantry", calories_kcal=350.0, protein_g=14.0, carbs_g=70.0, fat_g=2.0)
        food2 = Food(name="Olive Oil", category="Oils", calories_kcal=884.0, protein_g=0.0, carbs_g=0.0, fat_g=100.0)
        db.add_all([food1, food2])
        db.commit()

        backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "nutrition": {
                "foods": [
                    {"id": 1, "name": "Whole Wheat Pasta", "category": "Pantry", "calories_kcal": 350.0, "protein_g": 14.0, "carbs_g": 70.0, "fat_g": 2.0},
                    {"id": 2, "name": "Olive Oil", "category": "Oils", "calories_kcal": 884.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 100.0},
                ],
                "meal_plans": [
                    {
                        "name": "Mediterranean Week",
                        "start_date": "2026-11-01",
                        "end_date": "2026-11-07",
                        "days": [
                            {
                                "day_number": 1,
                                "meals": [
                                    {
                                        "plan_date": "2026-11-01",
                                        "day_number": 1,
                                        "meal_category": "lunch",
                                        "name": "Pasta with Olive Oil Day 1",
                                        "servings": 1,
                                        "items": [
                                            {"food_id": 1, "quantity": 100.0, "unit": "g"},
                                            {"food_id": 2, "quantity": 15.0, "unit": "ml"},
                                        ],
                                    }
                                ],
                            },
                            {
                                "day_number": 2,
                                "meals": [
                                    {
                                        "plan_date": "2026-11-02",
                                        "day_number": 2,
                                        "meal_category": "lunch",
                                        "name": "Pasta with Olive Oil Day 2",
                                        "servings": 1,
                                        "items": [
                                            {"food_id": 1, "quantity": 120.0, "unit": "g"},
                                            {"food_id": 2, "quantity": 15.0, "unit": "ml"},
                                        ],
                                    }
                                ],
                            },
                        ],
                    }
                ],
            },
        }

        res = backup_service.import_backup(db, backup)
        assert res.success is True
        assert res.imported_meal_plans == 1

        plan = db.query(MealPlan).first()
        assert plan.name == "Mediterranean Week"
        assert len(plan.planned_meals) == 2

        # Verify Shopping List items were generated properly
        shopping_items = db.query(ShoppingListItem).filter(ShoppingListItem.meal_plan_id == plan.id).all()
        assert len(shopping_items) == 2

        pasta_item = next(it for it in shopping_items if it.ingredient_name == "Whole Wheat Pasta")
        assert pasta_item.total_quantity == 220.0  # 100g + 120g aggregated
        assert pasta_item.unit == "g"
        assert pasta_item.category == "Pantry"

        oil_item = next(it for it in shopping_items if it.ingredient_name == "Olive Oil")
        assert oil_item.total_quantity == 30.0  # 15ml + 15ml aggregated
        assert oil_item.unit == "ml"
        assert oil_item.category == "Oils"


# =============================================================================
# Review 5 — Transaction safety & forced failures at multiple points
# =============================================================================

@pytest.mark.parametrize("failure_point", [
    "measurement_failure",
    "meal_log_failure",
    "recipe_ingredient_failure",
    "planned_exercise_failure",
    "logged_set_failure",
])
def test_review5_transaction_safety_forced_failures(failure_point: str):
    """Review 5: Force failures at different stages of the import process.
    Verify complete atomic rollback: 0 partial records remain, existing records unchanged, and DB remains usable.
    """
    engine, Session = create_isolated_sqlite_session()
    with Session() as db:
        # Pre-populate DB with existing records
        initial_prof = UserProfile(id=1, name="Safe User", height_cm=172.0)
        db.add(initial_prof)
        initial_food = Food(id=1, name="Existing Banana", calories_kcal=89.0, protein_g=1.1, carbs_g=23.0, fat_g=0.3)
        db.add(initial_food)
        db.commit()

        initial_profile_count = db.query(UserProfile).count()
        initial_food_count = db.query(Food).count()
        initial_meas_count = db.query(BodyMeasurement).count()
        initial_recipes_count = db.query(Recipe).count()
        initial_plans_count = db.query(WorkoutPlan).count()
        initial_sessions_count = db.query(WorkoutSessionLog).count()

        # Build backup payload tailored to trigger a failure at `failure_point`
        backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "body_measurements": [
                {"measured_at": "2026-10-25T08:00:00Z", "weight_kg": 70.0}
            ],
            "nutrition": {
                "foods": [
                    {"id": 100, "name": "Atomic Oats", "calories_kcal": 380.0, "protein_g": 13.0, "carbs_g": 68.0, "fat_g": 7.0}
                ],
                "meal_logs": [
                    {
                        "food_id": 100,
                        "logged_date": "2026-10-25",
                        "meal_category": "breakfast",
                        "quantity": 50.0,
                        "unit": "g",
                        "food_name": "Atomic Oats",
                        "calories_kcal": 190.0,
                        "protein_g": 6.5,
                        "carbs_g": 34.0,
                        "fat_g": 3.5,
                    }
                ],
                "recipes": [
                    {
                        "name": "Atomic Oatmeal",
                        "ingredients": [
                            {"food_id": 100, "quantity": 50.0, "unit": "g"}
                        ],
                    }
                ],
            },
            "training": {
                "custom_exercises": [
                    {"id": 100, "slug": "atomic_press", "name": "Atomic Press", "movement_category": "overhead", "primary_muscle": "shoulders", "equipment_required": "dumbbell"}
                ],
                "workout_plans": [
                    {
                        "name": "Atomic Workout Plan",
                        "start_date": "2026-10-26",
                        "end_date": "2026-11-01",
                        "sessions": [
                            {
                                "day_of_week_index": 0,
                                "day_of_week_name": "Monday",
                                "plan_date": "2026-10-26",
                                "session_name": "Atomic Session",
                                "session_focus": "Shoulders",
                                "exercises": [
                                    {
                                        "exercise_id": 100,
                                        "order_in_session": 1,
                                        "exercise_slug": "atomic_press",
                                        "exercise_name": "Atomic Press",
                                        "primary_muscle": "shoulders",
                                        "movement_category": "overhead",
                                        "equipment_required": "dumbbell",
                                    }
                                ],
                            }
                        ],
                    }
                ],
                "workout_session_logs": [
                    {
                        "session_name": "Atomic Log",
                        "started_at": "2026-10-26T18:00:00Z",
                        "exercises": [
                            {
                                "exercise_id": 100,
                                "order_in_session": 1,
                                "exercise_slug": "atomic_press",
                                "exercise_name": "Atomic Press",
                                "primary_muscle": "shoulders",
                                "equipment_required": "dumbbell",
                                "movement_category": "overhead",
                                "sets": [
                                    {"set_number": 1, "weight_kg": 20.0, "reps": 10, "is_completed": True}
                                ],
                            }
                        ],
                    }
                ],
            },
        }

        # Inject failure at specific point
        if failure_point == "measurement_failure":
            # Malformed measurement element causes TypeError / AttributeError
            backup["body_measurements"].append(None)
        elif failure_point == "meal_log_failure":
            # Malformed log entry
            backup["nutrition"]["meal_logs"].append(None)
        elif failure_point == "recipe_ingredient_failure":
            # Unresolvable food_id with no food_name snapshot triggers ValueError in RecipeIngredient
            backup["nutrition"]["recipes"][0]["ingredients"].append({"food_id": 999999})
        elif failure_point == "planned_exercise_failure":
            # Malformed planned exercise
            backup["training"]["workout_plans"][0]["sessions"][0]["exercises"].append(None)
        elif failure_point == "logged_set_failure":
            # Malformed set entry
            backup["training"]["workout_session_logs"][0]["exercises"][0]["sets"].append(None)

        result = backup_service.import_backup(db, backup)
        assert result.success is False
        assert "error" in result.message.lower() or "cannot resolve" in result.message.lower()

        # 1. Total Rollback Verification: 0 partial records remain from backup
        assert db.query(UserProfile).count() == initial_profile_count
        assert db.query(Food).count() == initial_food_count
        assert db.query(BodyMeasurement).count() == initial_meas_count
        assert db.query(Recipe).count() == initial_recipes_count
        assert db.query(WorkoutPlan).count() == initial_plans_count
        assert db.query(WorkoutSessionLog).count() == initial_sessions_count

        # Specifically verify "Atomic Oats" was rolled back and is NOT in DB
        assert db.query(Food).filter(Food.name == "Atomic Oats").first() is None
        assert db.query(Recipe).filter(Recipe.name == "Atomic Oatmeal").first() is None
        assert db.query(WorkoutPlan).filter(WorkoutPlan.name == "Atomic Workout Plan").first() is None
        assert db.query(WorkoutSessionLog).filter(WorkoutSessionLog.session_name == "Atomic Log").first() is None

        # 2. Existing records were untouched
        existing_banana = db.query(Food).filter(Food.id == 1).first()
        assert existing_banana is not None
        assert existing_banana.name == "Existing Banana"

        # 3. Database session remains fully usable afterward for a new valid operation
        new_valid_food = Food(name="Recovery Apple", calories_kcal=52.0, protein_g=0.3, carbs_g=14.0, fat_g=0.2)
        db.add(new_valid_food)
        db.commit()
        assert db.query(Food).filter(Food.name == "Recovery Apple").first() is not None
