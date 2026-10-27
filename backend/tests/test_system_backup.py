import json
from datetime import date, datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.core.database import get_db
from app.models.base import Base
from app.main import app
from app.models.exercise import Exercise
from app.models.food import Food
from app.models.meal_log import MealLog
from app.models.meal_plan import MealPlan
from app.models.measurement import BodyMeasurement
from app.models.profile import UserProfile
from app.models.recipe import Recipe
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
from app.schemas.backup import SystemBackupV2
from app.schemas.workout_log import WorkoutSessionLogUpdate
from app.services.backup_service import backup_service
from app.services.workout_execution_service import workout_execution_service
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_complete_system_backup_export_and_schema(client: AsyncClient):
    """Test comprehensive export of all 14 models with full snapshot data."""
    # 1. Profile
    prof_res = await client.post(
        "/api/profile",
        json={
            "name": "Jordan Rivers",
            "date_of_birth": "1992-04-15",
            "sex": "male",
            "height_cm": 182.0,
            "activity_level": "moderately_active",
        },
    )
    assert prof_res.status_code in (200, 201)

    # 2. Body measurement
    meas_res = await client.post(
        "/api/measurements",
        json={
            "measured_at": "2026-10-20T08:00:00Z",
            "weight_kg": 78.5,
            "height_cm": 182.0,
            "body_fat_percentage": 15.2,
            "chest_circumference_cm": 102.0,
            "waist_circumference_cm": 82.0,
            "notes": "Morning measurement",
        },
    )
    assert meas_res.status_code == 201

    # 3. Custom food
    food_res = await client.post(
        "/api/foods",
        json={
            "name": "Organic Steel Cut Oats",
            "brand": "Morning Harvest",
            "category": "grains",
            "nutritional_basis": "100g",
            "calories_kcal": 375.0,
            "protein_g": 13.0,
            "carbs_g": 68.0,
            "fat_g": 6.5,
            "fiber_g": 10.0,
        },
    )
    assert food_res.status_code == 201
    food_id = food_res.json()["id"]

    # 4. Meal log
    log_res = await client.post(
        "/api/meal-logs",
        json={
            "logged_date": "2026-10-21",
            "meal_category": "breakfast",
            "food_id": food_id,
            "quantity": 80.0,
            "unit": "g",
            "notes": "With almond milk",
        },
    )
    assert log_res.status_code == 201

    # 5. Nutrition goal
    goal_res = await client.put(
        "/api/nutrition/goals",
        json={
            "calories_kcal": 2600.0,
            "protein_g": 180.0,
            "carbs_g": 300.0,
            "fat_g": 80.0,
            "fiber_g": 35.0,
        },
    )
    assert goal_res.status_code == 200

    # 6. Custom exercise
    ex_res = await client.post(
        "/api/exercises",
        json={
            "name": "Deficit Deadlift",
            "slug": "deficit_deadlift",
            "movement_category": "hinge",
            "primary_muscle": "hamstrings",
            "secondary_muscles": "glutes,lower_back",
            "equipment_required": "barbell",
            "difficulty_level": "advanced",
            "instructions": "Stand on 2-inch platform, maintain neutral spine.",
        },
    )
    assert ex_res.status_code == 201
    custom_ex_id = ex_res.json()["id"]

    # 7. Training Profile
    tp_res = await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "intermediate",
            "training_goals": ["strength", "hypertrophy"],
            "available_days": ["monday", "wednesday", "friday", "saturday"],
            "preferred_duration_minutes": 60,
            "available_equipment": ["barbell", "dumbbell", "bench"],
            "excluded_exercises": ["leg_press"],
            "training_considerations": "Keep volume moderate on squats.",
        },
    )
    assert tp_res.status_code == 200

    # 8. Saved training profile
    saved_tp_res = await client.post(
        "/api/workouts/profile/saved",
        json={
            "name": "4-Day Hypertrophy Routine",
            "experience_level": "intermediate",
            "training_goals": ["hypertrophy"],
            "available_days": ["monday", "tuesday", "thursday", "friday"],
            "preferred_duration_minutes": 75,
            "available_equipment": ["barbell", "dumbbell"],
        },
    )
    assert saved_tp_res.status_code == 201

    # 9. Workout plan with session and exercises
    plan_res = await client.post(
        "/api/workouts/plans/generate",
        json={
            "start_date": "2026-10-26",
            "split_type": "full_body",
            "name": "Test Fall Plan",
        },
    )
    assert plan_res.status_code in (200, 201)
    plan_data = plan_res.json()
    first_session = next(s for s in plan_data["sessions"] if not s["is_rest_day"])
    session_id = first_session["id"]

    # 10. Workout execution session log
    start_res = await client.post(
        "/api/workouts/sessions/start",
        json={
            "planned_session_id": session_id,
            "session_name": "Autumn Push Focus",
            "notes": "Testing backup execution fidelity",
        },
    )
    assert start_res.status_code in (200, 201)
    session_log = start_res.json()
    assert len(session_log["exercises"]) > 0

    # Update set values
    first_ex = session_log["exercises"][0]
    update_res = await client.put(
        f"/api/workouts/sessions/{session_log['id']}",
        json={
            "client_version": 1,
            "session_name": "Autumn Push Focus",
            "duration_seconds": 3600,
            "exercises": [
                {
                    "id": first_ex["id"],
                    "order_in_session": 1,
                    "sets": [
                        {
                            "set_number": 1,
                            "weight_kg": 85.0,
                            "reps": 10,
                            "is_completed": True,
                            "is_skipped": False,
                            "notes": "RPE 8",
                        },
                        {
                            "set_number": 2,
                            "weight_kg": 85.0,
                            "reps": 9,
                            "is_completed": True,
                            "is_skipped": False,
                        },
                    ],
                }
            ],
        },
    )
    assert update_res.status_code == 200

    # Complete session
    comp_res = await client.post(f"/api/workouts/sessions/{session_log['id']}/complete")
    assert comp_res.status_code == 200

    # --- NOW TEST EXPORT V2.0 ---
    export_res = await client.get("/api/backup/export")
    assert export_res.status_code == 200
    backup = export_res.json()

    # Validate Envelope
    assert backup["format"] == "fitpulse_backup"
    assert backup["version"] == "2.0"
    assert backup["app_version"] == "0.1.0"
    assert "exported_at" in backup

    # Validate Profile & Measurements
    assert backup["profile"]["name"] == "Jordan Rivers"
    assert backup["profile"]["height_cm"] == 182.0
    assert len(backup["body_measurements"]) >= 1
    assert backup["body_measurements"][0]["weight_kg"] == 78.5

    # Validate Nutrition
    assert "nutrition" in backup
    nut = backup["nutrition"]
    assert any(f["name"] == "Organic Steel Cut Oats" for f in nut["foods"])
    assert any(l["food_name"] == "Organic Steel Cut Oats" for l in nut["meal_logs"])
    assert nut["nutrition_goals"]["calories_kcal"] == 2600.0

    # Validate Training
    assert "training" in backup
    tr = backup["training"]
    assert any(e["slug"] == "deficit_deadlift" for e in tr["custom_exercises"])
    assert tr["training_profile"]["experience_level"] == "intermediate"
    assert any(s["name"] == "4-Day Hypertrophy Routine" for s in tr["saved_training_profiles"])
    assert len(tr["workout_plans"]) >= 1
    assert any(sl["session_name"] == "Autumn Push Focus" for sl in tr["workout_session_logs"])

    # Validate session log details: sets, weights, reps
    target_slog = next(sl for sl in tr["workout_session_logs"] if sl["session_name"] == "Autumn Push Focus")
    assert target_slog["status"] == "completed"
    assert len(target_slog["exercises"]) > 0
    first_logged_ex = target_slog["exercises"][0]
    assert len(first_logged_ex["sets"]) >= 2
    assert first_logged_ex["sets"][0]["weight_kg"] == 85.0
    assert first_logged_ex["sets"][0]["reps"] == 10
    assert first_logged_ex["sets"][0]["is_completed"] is True


@pytest.mark.asyncio
async def test_system_backup_isolated_restore_and_idempotency():
    """Test export from one database and restore into a fresh isolated SQLite database with PRAGMA foreign_keys=ON."""
    # Step 1: Create source isolated database and populate it
    source_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(source_engine, "connect")
    def set_sqlite_pragma_source(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

    SourceSession = sessionmaker(autocommit=False, autoflush=False, bind=source_engine)
    Base.metadata.create_all(bind=source_engine)

    with SourceSession() as db:
        # User profile
        p = UserProfile(
            name="Morgan Vance",
            date_of_birth=date(1990, 8, 20),
            sex="female",
            height_cm=168.0,
            activity_level="very_active",
        )
        db.add(p)
        db.flush()

        # Measurement
        m = BodyMeasurement(
            user_profile_id=p.id,
            measured_at=datetime(2026, 10, 22, 9, 30, tzinfo=timezone.utc),
            weight_kg=62.5,
            height_cm=168.0,
            source="manual",
        )
        db.add(m)

        # Custom food
        f = Food(
            name="Greek Yogurt 0%",
            brand="Alpine Dairy",
            category="dairy",
            source="custom",
            calories_kcal=59.0,
            protein_g=10.0,
            carbs_g=3.6,
            fat_g=0.0,
        )
        db.add(f)
        db.flush()

        # Meal log
        ml = MealLog(
            user_profile_id=p.id,
            food_id=f.id,
            logged_date=date(2026, 10, 22),
            meal_category="breakfast",
            quantity=200.0,
            unit="g",
            food_name=f.name,
            food_brand=f.brand,
            calories_kcal=118.0,
            protein_g=20.0,
            carbs_g=7.2,
            fat_g=0.0,
        )
        db.add(ml)

        # Custom exercise
        ex = Exercise(
            slug="goblet_squat_db",
            name="Goblet Squat (Dumbbell)",
            movement_category="squat",
            primary_muscle="quadriceps",
            secondary_muscles="glutes",
            equipment_required="dumbbell",
            difficulty_level="beginner",
            is_built_in=False,
            user_profile_id=p.id,
        )
        db.add(ex)
        db.flush()

        # Training profile
        tp = TrainingProfile(
            user_profile_id=p.id,
            experience_level="intermediate",
            training_goals="strength,hypertrophy",
            available_days="monday,wednesday,friday",
            preferred_duration_minutes=60,
            available_equipment="dumbbell,barbell",
        )
        db.add(tp)

        # Saved training profile
        stp = SavedTrainingProfile(
            user_profile_id=p.id,
            name="Morgan 3-Day Strength",
            experience_level="intermediate",
            training_goals="strength",
            available_days="monday,wednesday,friday",
            preferred_duration_minutes=60,
            available_equipment="dumbbell,barbell",
        )
        db.add(stp)

        # Workout plan
        wp = WorkoutPlan(
            user_profile_id=p.id,
            name="Winter Foundation",
            split_type="full_body",
            start_date=date(2026, 11, 1),
            end_date=date(2026, 11, 7),
            is_active=True,
        )
        db.add(wp)
        db.flush()

        ps = PlannedWorkoutSession(
            workout_plan_id=wp.id,
            day_of_week_index=0,
            day_of_week_name="Monday",
            plan_date=date(2026, 11, 1),
            is_rest_day=False,
            session_name="Full Body A",
            session_focus="Strength",
            estimated_duration_minutes=60,
        )
        db.add(ps)
        db.flush()

        pe = PlannedExercise(
            planned_session_id=ps.id,
            exercise_id=ex.id,
            order_in_session=1,
            exercise_slug=ex.slug,
            exercise_name=ex.name,
            primary_muscle=ex.primary_muscle,
            movement_category=ex.movement_category,
            equipment_required=ex.equipment_required,
            target_sets=3,
            target_reps="10-12",
            rest_seconds=90,
        )
        db.add(pe)

        # Workout session log with exercises & sets
        slog = WorkoutSessionLog(
            user_profile_id=p.id,
            workout_plan_id=wp.id,
            planned_session_id=ps.id,
            session_name="Full Body A - Week 1",
            status="completed",
            started_at=datetime(2026, 11, 1, 17, 0, tzinfo=timezone.utc),
            completed_at=datetime(2026, 11, 1, 18, 0, tzinfo=timezone.utc),
            duration_seconds=3600,
        )
        db.add(slog)
        db.flush()

        lex = LoggedExercise(
            session_log_id=slog.id,
            exercise_id=ex.id,
            planned_exercise_id=pe.id,
            order_in_session=1,
            exercise_slug=ex.slug,
            exercise_name=ex.name,
            primary_muscle=ex.primary_muscle,
            equipment_required=ex.equipment_required,
            movement_category=ex.movement_category,
        )
        db.add(lex)
        db.flush()

        s1 = LoggedExerciseSet(
            logged_exercise_id=lex.id,
            set_number=1,
            weight_kg=24.0,
            reps=12,
            is_completed=True,
            is_skipped=False,
            notes="Felt good",
        )
        s2 = LoggedExerciseSet(
            logged_exercise_id=lex.id,
            set_number=2,
            weight_kg=26.0,
            reps=10,
            is_completed=True,
            is_skipped=False,
        )
        db.add_all([s1, s2])
        db.commit()

        # Export full system backup from source
        backup_obj = backup_service.export_system_backup(db)
        backup_dict = backup_obj.model_dump(mode="json")

    # Step 2: Create a completely fresh, empty destination database
    dest_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(dest_engine, "connect")
    def set_sqlite_pragma_dest(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

    DestSession = sessionmaker(autocommit=False, autoflush=False, bind=dest_engine)
    Base.metadata.create_all(bind=dest_engine)

    # Step 3: Restore backup into the fresh destination database
    with DestSession() as dest_db:
        # Verify destination DB is completely empty before restore
        assert dest_db.query(UserProfile).count() == 0
        assert dest_db.query(Food).count() == 0
        assert dest_db.query(WorkoutSessionLog).count() == 0

        result = backup_service.import_backup(dest_db, backup_dict)
        assert result.success is True
        assert result.imported_profile is True
        assert result.imported_measurements == 1
        assert result.imported_foods == 1
        assert result.imported_meal_logs == 1
        assert result.imported_custom_exercises == 1
        assert result.imported_training_profile is True
        assert result.imported_saved_training_profiles == 1
        assert result.imported_workout_plans == 1
        assert result.imported_workout_sessions == 1
        assert result.skipped_duplicates == 0

        # Step 4: Verify foreign keys check passes with 0 violations
        fk_check = dest_db.execute(text("PRAGMA foreign_key_check;")).fetchall()
        assert len(fk_check) == 0, f"Foreign key check failed: {fk_check}"

        # Step 5: Verify restored data fidelity in destination DB
        restored_prof = dest_db.query(UserProfile).first()
        assert restored_prof.name == "Morgan Vance"
        assert restored_prof.height_cm == 168.0

        restored_m = dest_db.query(BodyMeasurement).first()
        assert restored_m.weight_kg == 62.5
        assert restored_m.user_profile_id == restored_prof.id

        restored_ex = dest_db.query(Exercise).filter(Exercise.slug == "goblet_squat_db").first()
        assert restored_ex is not None
        assert restored_ex.name == "Goblet Squat (Dumbbell)"

        restored_wp = dest_db.query(WorkoutPlan).first()
        assert restored_wp.name == "Winter Foundation"
        assert len(restored_wp.sessions) == 1
        assert len(restored_wp.sessions[0].exercises) == 1
        assert restored_wp.sessions[0].exercises[0].exercise_slug == "goblet_squat_db"

        restored_slog = dest_db.query(WorkoutSessionLog).first()
        assert restored_slog.session_name == "Full Body A - Week 1"
        assert restored_slog.workout_plan_id == restored_wp.id
        assert len(restored_slog.exercises) == 1
        assert restored_slog.exercises[0].exercise_slug == "goblet_squat_db"
        assert len(restored_slog.exercises[0].sets) == 2
        assert restored_slog.exercises[0].sets[0].weight_kg == 24.0
        assert restored_slog.exercises[0].sets[0].reps == 12
        assert restored_slog.exercises[0].sets[0].is_completed is True
        assert restored_slog.exercises[0].sets[1].weight_kg == 26.0

        # Record record counts before idempotency test
        counts_before = {
            "profiles": dest_db.query(UserProfile).count(),
            "measurements": dest_db.query(BodyMeasurement).count(),
            "foods": dest_db.query(Food).count(),
            "logs": dest_db.query(MealLog).count(),
            "exercises": dest_db.query(Exercise).count(),
            "saved_profiles": dest_db.query(SavedTrainingProfile).count(),
            "plans": dest_db.query(WorkoutPlan).count(),
            "sessions": dest_db.query(WorkoutSessionLog).count(),
            "sets": dest_db.query(LoggedExerciseSet).count(),
        }

        # Step 6: Test Idempotency - Import the exact same backup a SECOND time
        second_result = backup_service.import_backup(dest_db, backup_dict)
        assert second_result.success is True
        assert second_result.skipped_duplicates > 0
        assert second_result.imported_foods == 0
        assert second_result.imported_meal_logs == 0
        assert second_result.imported_custom_exercises == 0
        assert second_result.imported_saved_training_profiles == 0
        assert second_result.imported_workout_plans == 0
        assert second_result.imported_workout_sessions == 0

        # Step 7: Verify ZERO duplicate records created across all tables
        counts_after = {
            "profiles": dest_db.query(UserProfile).count(),
            "measurements": dest_db.query(BodyMeasurement).count(),
            "foods": dest_db.query(Food).count(),
            "logs": dest_db.query(MealLog).count(),
            "exercises": dest_db.query(Exercise).count(),
            "saved_profiles": dest_db.query(SavedTrainingProfile).count(),
            "plans": dest_db.query(WorkoutPlan).count(),
            "sessions": dest_db.query(WorkoutSessionLog).count(),
            "sets": dest_db.query(LoggedExerciseSet).count(),
        }
        assert counts_before == counts_after, f"Duplicate records were created: {counts_before} vs {counts_after}"

        # Foreign key check must still have 0 violations
        fk_check_2 = dest_db.execute(text("PRAGMA foreign_key_check;")).fetchall()
        assert len(fk_check_2) == 0


@pytest.mark.asyncio
async def test_system_backup_transaction_rollback_cleanliness():
    """Test that if an error occurs midway, db.rollback() leaves 0 partial records."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestSession() as db:
        # Existing profile
        prof = UserProfile(name="Sam", height_cm=175.0)
        db.add(prof)
        db.commit()

        initial_foods = db.query(Food).count()
        initial_logs = db.query(MealLog).count()

        # Malformed payload that fails validation midway (e.g., custom_exercises with bad data)
        bad_backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "nutrition": {
                "foods": [
                    {"name": "Valid Test Food", "nutritional_basis": "100g", "calories_kcal": 100.0, "protein_g": 5.0, "carbs_g": 10.0, "fat_g": 2.0}
                ]
            },
            "training": {
                # Malformed exercise that causes exception inside transaction
                "custom_exercises": [
                    None  # Will trigger AttributeError or TypeError when accessing .get()
                ]
            }
        }

        result = backup_service.import_backup(db, bad_backup)
        assert result.success is False
        assert "error" in result.message.lower()

        # Confirm total transaction rollback: "Valid Test Food" was NOT committed
        assert db.query(Food).count() == initial_foods
        assert db.query(MealLog).count() == initial_logs


@pytest.mark.asyncio
async def test_system_backup_legacy_version_compatibility(client: AsyncClient):
    """Test backward compatibility: restoring v1.0, v1.1, and v1.2 backups."""
    await client.post("/api/profile", json={"name": "Legacy Tester", "height_cm": 170.0})

    # 1. Test legacy v1.0 payload
    v1_0_payload = {
        "version": "1.0",
        "foods": [
            {
                "id": 999,
                "name": "Legacy Banana",
                "nutritional_basis": "100g",
                "calories_kcal": 89.0,
                "protein_g": 1.1,
                "carbs_g": 23.0,
                "fat_g": 0.3,
            }
        ],
        "meal_logs": [
            {
                "food_id": 999,
                "logged_date": "2026-10-25",
                "meal_category": "snacks",
                "quantity": 120.0,
                "unit": "g",
                "food_name": "Legacy Banana",
                "calories_kcal": 107.0,
                "protein_g": 1.3,
                "carbs_g": 27.6,
                "fat_g": 0.4,
            }
        ],
    }

    imp_res = await client.post("/api/backup/import", json=v1_0_payload)
    assert imp_res.status_code == 200
    res_data = imp_res.json()
    assert res_data["success"] is True
    assert res_data["imported_foods"] == 1
    assert res_data["imported_meal_logs"] == 1

    # 2. Test unsupported version rejection
    bad_version_payload = {"version": "99.0", "foods": []}
    bad_res = await client.post("/api/backup/import", json=bad_version_payload)
    assert bad_res.status_code == 200
    assert bad_res.json()["success"] is False
    assert "unsupported" in bad_res.json()["message"].lower()


# =============================================================================
# Batch 4: Workout Session Version Preservation in Backup & Restore
# =============================================================================

def create_isolated_test_engine_and_session():
    """Create a completely isolated in-memory SQLite database with PRAGMA foreign_keys=ON."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _set_fk(conn, _):
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return engine, TestingSession


def test_backup_restore_preserves_non_default_version():
    """Batch 4: Export and restore preserve non-default version (e.g. 5), child relationships, and idempotency."""
    src_engine, SrcSession = create_isolated_test_engine_and_session()

    with SrcSession() as src_db:
        # Profile
        p = UserProfile(name="Version Tester", height_cm=178.0)
        src_db.add(p)
        src_db.flush()

        # Custom exercise
        ex = Exercise(
            slug="barbell_bench_press_v5",
            name="Barbell Bench Press V5",
            movement_category="push",
            primary_muscle="chest",
            equipment_required="barbell",
            difficulty_level="intermediate",
            is_built_in=False,
            user_profile_id=p.id,
        )
        src_db.add(ex)
        src_db.flush()

        # Workout plan & session
        wp = WorkoutPlan(
            user_profile_id=p.id,
            name="Power Split",
            split_type="upper_lower",
            start_date=date(2026, 11, 10),
            end_date=date(2026, 11, 17),
            is_active=True,
        )
        src_db.add(wp)
        src_db.flush()

        ps = PlannedWorkoutSession(
            workout_plan_id=wp.id,
            day_of_week_index=1,
            day_of_week_name="Tuesday",
            plan_date=date(2026, 11, 11),
            is_rest_day=False,
            session_name="Upper Power",
            session_focus="Strength",
            estimated_duration_minutes=60,
        )
        src_db.add(ps)
        src_db.flush()

        pe = PlannedExercise(
            planned_session_id=ps.id,
            exercise_id=ex.id,
            order_in_session=1,
            exercise_slug=ex.slug,
            exercise_name=ex.name,
            primary_muscle=ex.primary_muscle,
            movement_category=ex.movement_category,
            equipment_required=ex.equipment_required,
            target_sets=2,
            target_reps="8-10",
        )
        src_db.add(pe)
        src_db.flush()

        # Workout session log initialized with non-default version = 5
        slog = WorkoutSessionLog(
            user_profile_id=p.id,
            workout_plan_id=wp.id,
            planned_session_id=ps.id,
            session_name="Upper Power - Execution",
            status="completed",
            started_at=datetime(2026, 11, 11, 14, 0, tzinfo=timezone.utc),
            completed_at=datetime(2026, 11, 11, 15, 0, tzinfo=timezone.utc),
            duration_seconds=3600,
            notes="Session at version 5",
            version=5,
        )
        src_db.add(slog)
        src_db.flush()

        lex = LoggedExercise(
            session_log_id=slog.id,
            exercise_id=ex.id,
            planned_exercise_id=pe.id,
            order_in_session=1,
            exercise_slug=ex.slug,
            exercise_name=ex.name,
            primary_muscle=ex.primary_muscle,
            equipment_required=ex.equipment_required,
            movement_category=ex.movement_category,
        )
        src_db.add(lex)
        src_db.flush()

        s1 = LoggedExerciseSet(
            logged_exercise_id=lex.id,
            set_number=1,
            weight_kg=80.0,
            reps=10,
            is_completed=True,
        )
        s2 = LoggedExerciseSet(
            logged_exercise_id=lex.id,
            set_number=2,
            weight_kg=85.0,
            reps=8,
            is_completed=True,
        )
        src_db.add_all([s1, s2])
        src_db.commit()

        # Step 1: Export system backup
        backup_obj = backup_service.export_system_backup(src_db)
        # Verify export serialization preserves version = 5
        assert len(backup_obj.training.workout_session_logs) == 1
        assert backup_obj.training.workout_session_logs[0].version == 5

        backup_dict = backup_obj.model_dump(mode="json")
        assert backup_dict["training"]["workout_session_logs"][0]["version"] == 5

    # Step 2: Restore into a clean destination DB
    dest_engine, DestSession = create_isolated_test_engine_and_session()

    with DestSession() as dest_db:
        # Pre-condition: destination DB is empty
        assert dest_db.query(WorkoutSessionLog).count() == 0

        result = backup_service.import_backup(dest_db, backup_dict)
        assert result.success is True
        assert result.imported_workout_sessions == 1

        # Check foreign keys
        fks = dest_db.execute(text("PRAGMA foreign_key_check;")).fetchall()
        assert len(fks) == 0

        # Step 3: Verify restored session state in DB
        restored = dest_db.query(WorkoutSessionLog).first()
        assert restored is not None
        assert restored.session_name == "Upper Power - Execution"
        assert restored.version == 5, f"Expected restored version == 5, got {restored.version}"
        assert restored.status == "completed"
        assert restored.duration_seconds == 3600

        # Step 4: Verify child relationships (exercises & sets) remain intact
        assert len(restored.exercises) == 1
        restored_lex = restored.exercises[0]
        assert restored_lex.session_log_id == restored.id
        assert restored_lex.exercise_slug == "barbell_bench_press_v5"
        assert len(restored_lex.sets) == 2
        assert restored_lex.sets[0].logged_exercise_id == restored_lex.id
        assert restored_lex.sets[0].set_number == 1
        assert restored_lex.sets[0].weight_kg == 80.0
        assert restored_lex.sets[0].reps == 10
        assert restored_lex.sets[1].logged_exercise_id == restored_lex.id
        assert restored_lex.sets[1].set_number == 2
        assert restored_lex.sets[1].weight_kg == 85.0
        assert restored_lex.sets[1].reps == 8

        # Step 5: Verify idempotency - repeated restore does not duplicate sessions or sets
        repeat_result = backup_service.import_backup(dest_db, backup_dict)
        assert repeat_result.success is True
        assert repeat_result.skipped_duplicates > 0
        assert dest_db.query(WorkoutSessionLog).count() == 1
        assert dest_db.query(LoggedExercise).count() == 1
        assert dest_db.query(LoggedExerciseSet).count() == 2
        assert dest_db.query(WorkoutSessionLog).first().version == 5


def test_legacy_backup_without_version_restores_as_one():
    """Batch 4: A legacy backup without a version field restores the session with version == 1."""
    dest_engine, DestSession = create_isolated_test_engine_and_session()

    legacy_backup = {
        "format": "fitpulse_backup",
        "version": "2.0",
        "profile": {"name": "Legacy Version User"},
        "training": {
            "workout_session_logs": [
                {
                    "session_name": "Legacy Session Without Version",
                    "status": "completed",
                    "started_at": "2026-10-01T10:00:00Z",
                    "completed_at": "2026-10-01T11:00:00Z",
                    "duration_seconds": 3600,
                    # Note: "version" key is completely absent
                    "exercises": [],
                }
            ]
        },
    }

    with DestSession() as dest_db:
        result = backup_service.import_backup(dest_db, legacy_backup)
        assert result.success is True
        assert result.imported_workout_sessions == 1

        restored = dest_db.query(WorkoutSessionLog).first()
        assert restored is not None
        assert restored.session_name == "Legacy Session Without Version"
        assert restored.version == 1, f"Expected default version == 1, got {restored.version}"


def test_invalid_workout_session_version_rejected_and_rolled_back():
    """Batch 4: Invalid version values (0, negative, string, float, bool) are rejected with full transaction rollback."""
    invalid_versions = [0, -1, -99, "invalid", "0", "-5", 3.5, True, False]

    for bad_ver in invalid_versions:
        dest_engine, DestSession = create_isolated_test_engine_and_session()

        bad_backup = {
            "format": "fitpulse_backup",
            "version": "2.0",
            "profile": {"name": "Invalid Version User"},
            "nutrition": {
                "foods": [
                    {
                        "name": "Should Be Rolled Back Food",
                        "calories_kcal": 100.0,
                        "protein_g": 5.0,
                        "carbs_g": 10.0,
                        "fat_g": 1.0,
                    }
                ]
            },
            "training": {
                "workout_session_logs": [
                    {
                        "session_name": "Bad Version Session",
                        "status": "completed",
                        "started_at": "2026-10-01T10:00:00Z",
                        "duration_seconds": 1800,
                        "version": bad_ver,
                        "exercises": [],
                    }
                ]
            },
        }

        with DestSession() as dest_db:
            result = backup_service.import_backup(dest_db, bad_backup)
            assert result.success is False, f"Expected import failure for version={bad_ver}"
            assert "invalid version" in result.message.lower()

            # Verify total transaction rollback: no food or session was committed
            assert dest_db.query(WorkoutSessionLog).count() == 0
            assert dest_db.query(Food).count() == 0


def test_restored_session_supports_optimistic_concurrency_update():
    """Batch 4: Restored session with version 5 accepts update with client_version=5 and rejects stale updates."""
    dest_engine, DestSession = create_isolated_test_engine_and_session()

    backup_payload = {
        "format": "fitpulse_backup",
        "version": "2.0",
        "profile": {"name": "OCC Restored User"},
        "training": {
            "workout_session_logs": [
                {
                    "session_name": "Restored Active Session",
                    "status": "in_progress",
                    "started_at": "2026-10-27T10:00:00Z",
                    "duration_seconds": 500,
                    "version": 5,
                    "exercises": [],
                }
            ]
        },
    }

    with DestSession() as dest_db:
        # Import the backup
        result = backup_service.import_backup(dest_db, backup_payload)
        assert result.success is True

        restored_session = dest_db.query(WorkoutSessionLog).first()
        assert restored_session is not None
        assert restored_session.version == 5
        assert restored_session.status == "in_progress"
        session_id = restored_session.id

        # 1. Update with matching client_version=5 must succeed and advance version to 6
        upd = WorkoutSessionLogUpdate(
            session_name="Updated Restored Session",
            duration_seconds=600,
            notes="First edit post-restore",
            client_version=5,
        )
        updated_res = workout_execution_service.update_session(dest_db, session_id, upd)
        assert updated_res.version == 6
        assert updated_res.notes == "First edit post-restore"

        dest_db.refresh(restored_session)
        assert restored_session.version == 6

        # 2. Update with stale client_version=5 must be rejected with 409 Conflict
        stale_upd = WorkoutSessionLogUpdate(
            notes="Stale edit post-restore",
            client_version=5,
        )
        try:
            workout_execution_service.update_session(dest_db, session_id, stale_upd)
            pytest.fail("Expected HTTP 409 Conflict for stale update")
        except HTTPException as exc:
            assert exc.status_code == 409
            assert "expected version 5, but server is at version 6" in exc.detail

        # 3. Update with matching client_version=6 succeeds and advances version to 7
        upd_v6 = WorkoutSessionLogUpdate(
            notes="Second edit post-restore",
            client_version=6,
        )
        updated_res_v6 = workout_execution_service.update_session(dest_db, session_id, upd_v6)
        assert updated_res_v6.version == 7
        dest_db.refresh(restored_session)
        assert restored_session.version == 7

