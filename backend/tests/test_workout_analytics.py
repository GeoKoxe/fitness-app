from datetime import datetime, timedelta
import pytest
from httpx import AsyncClient

from app.db.seed_exercises import seed_built_in_exercises
from app.models.profile import UserProfile
from app.models.training_profile import TrainingProfile
from app.models.workout_log import (
    LoggedExercise,
    LoggedExerciseSet,
    WorkoutSessionLog,
)
from app.services.workout_analytics_service import (
    calculate_epley_1rm,
    parse_target_rep_range,
)
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def seed_exercises_db():
    db = TestSessionLocal()
    try:
        seed_built_in_exercises(db)
    finally:
        db.close()


def test_epley_1rm_and_target_rep_parsing():
    # 1. 1 rep test (1RM == weight)
    assert calculate_epley_1rm(100.0, 1) == 100.0
    # 2. 10 reps @ 100kg -> 100 * (1 + 10/30) = 133.3
    assert calculate_epley_1rm(100.0, 10) == 133.3
    # 3. Invalid or out of bounds reps (>12 or <1)
    assert calculate_epley_1rm(100.0, 15) is None
    assert calculate_epley_1rm(100.0, 0) is None
    assert calculate_epley_1rm(None, 8) is None
    assert calculate_epley_1rm(0, 8) is None

    # Rep parsing
    assert parse_target_rep_range("8-10") == (8, 10)
    assert parse_target_rep_range("10-12") == (10, 12)
    assert parse_target_rep_range("5") == (5, 5)
    assert parse_target_rep_range(None) == (8, 12)
    assert parse_target_rep_range("invalid") == (8, 12)


@pytest.mark.asyncio
async def test_empty_analytics_and_missing_identifiers(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Analytics User"})

    # 1. Summary with 0 workouts
    resp = await client.get("/api/workouts/analytics/summary?time_range=4w")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_completed_workouts"] == 0
    assert data["active_training_days"] == 0
    assert data["total_training_duration_seconds"] == 0
    assert data["average_session_duration_seconds"] is None
    assert data["total_completed_sets"] == 0
    assert data["total_completed_reps"] == 0
    assert data["exercise_frequency"] == []

    # 2. Weekly series with 0 workouts
    resp_weekly = await client.get("/api/workouts/analytics/weekly?time_range=4w")
    assert resp_weekly.status_code == 200
    w_data = resp_weekly.json()
    assert len(w_data["weeks"]) == 4
    for wk in w_data["weeks"]:
        assert wk["completed_workouts"] == 0
        assert wk["completed_sets"] == 0

    # 3. Invalid exercise identifier
    resp_ex = await client.get("/api/workouts/analytics/exercises/non_existent_exercise_123")
    assert resp_ex.status_code == 404

    # 4. Invalid time range
    resp_bad_range = await client.get("/api/workouts/analytics/summary?time_range=invalid")
    assert resp_bad_range.status_code == 400


@pytest.mark.asyncio
async def test_workout_analytics_metrics_and_status_filtering(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Analytics User"})

    db = TestSessionLocal()
    now = datetime.now()
    try:
        profile = db.query(UserProfile).first()
        assert profile is not None

        # Configure training profile with 3 days/week
        t_prof = db.query(TrainingProfile).filter_by(user_profile_id=profile.id).first()
        if not t_prof:
            t_prof = TrainingProfile(
                user_profile_id=profile.id,
                experience_level="intermediate",
                training_goals="strength",
                available_days="monday,wednesday,friday",
                available_equipment="barbell,bodyweight",
            )
            db.add(t_prof)
        else:
            t_prof.available_days = "monday,wednesday,friday"
        db.commit()

        # Session 1: Completed 5 days ago (Duration: 3000s, 3 completed sets bench press)
        s1 = WorkoutSessionLog(
            user_profile_id=profile.id,
            session_name="Upper Body A",
            status="completed",
            started_at=now - timedelta(days=5, hours=1),
            completed_at=now - timedelta(days=5),
            duration_seconds=3000,
        )
        db.add(s1)
        db.flush()

        ex1 = LoggedExercise(
            session_log_id=s1.id,
            order_in_session=1,
            exercise_slug="barbell_bench_press",
            exercise_name="Barbell Bench Press",
            primary_muscle="chest",
            equipment_required="barbell",
            movement_category="horizontal_push",
            target_sets=3,
            target_reps="8-10",
        )
        db.add(ex1)
        db.flush()

        # Sets: 80kg x 10, 80kg x 10, 80kg x 10 (all completed)
        for i in range(1, 4):
            db.add(
                LoggedExerciseSet(
                    logged_exercise_id=ex1.id,
                    set_number=i,
                    weight_kg=80.0,
                    reps=10,
                    is_completed=True,
                    is_skipped=False,
                )
            )

        # Session 2: Completed 3 days ago (Duration: 2400s, Pull-ups bodyweight: 1 completed, 1 skipped)
        s2 = WorkoutSessionLog(
            user_profile_id=profile.id,
            session_name="Upper Body B",
            status="completed",
            started_at=now - timedelta(days=3, hours=1),
            completed_at=now - timedelta(days=3),
            duration_seconds=2400,
        )
        db.add(s2)
        db.flush()

        ex2 = LoggedExercise(
            session_log_id=s2.id,
            order_in_session=1,
            exercise_slug="pull_up",
            exercise_name="Pull-up",
            primary_muscle="back",
            equipment_required="bodyweight",
            movement_category="vertical_pull",
            target_sets=2,
            target_reps="8-10",
        )
        db.add(ex2)
        db.flush()

        # Set 1 completed: reps=8, weight=None
        db.add(
            LoggedExerciseSet(
                logged_exercise_id=ex2.id,
                set_number=1,
                weight_kg=None,
                reps=8,
                is_completed=True,
                is_skipped=False,
            )
        )
        # Set 2 skipped
        db.add(
            LoggedExerciseSet(
                logged_exercise_id=ex2.id,
                set_number=2,
                weight_kg=None,
                reps=None,
                is_completed=False,
                is_skipped=True,
            )
        )

        # Session 3: CANCELLED session 2 days ago (MUST be excluded from completed counts!)
        s3_cancelled = WorkoutSessionLog(
            user_profile_id=profile.id,
            session_name="Cancelled Session",
            status="cancelled",
            started_at=now - timedelta(days=2, hours=1),
            completed_at=now - timedelta(days=2),
            duration_seconds=1200,
        )
        db.add(s3_cancelled)
        db.flush()

        ex3_canc = LoggedExercise(
            session_log_id=s3_cancelled.id,
            order_in_session=1,
            exercise_slug="barbell_bench_press",
            exercise_name="Barbell Bench Press",
            primary_muscle="chest",
            equipment_required="barbell",
            movement_category="horizontal_push",
            target_sets=1,
            target_reps="8-10",
        )
        db.add(ex3_canc)
        db.flush()
        db.add(
            LoggedExerciseSet(
                logged_exercise_id=ex3_canc.id,
                set_number=1,
                weight_kg=120.0,
                reps=5,
                is_completed=True,
                is_skipped=False,
            )
        )

        # Session 4: IN_PROGRESS session 1 day ago (MUST be excluded from completed counts!)
        s4_active = WorkoutSessionLog(
            user_profile_id=profile.id,
            session_name="In Progress Session",
            status="in_progress",
            started_at=now - timedelta(days=1),
            completed_at=None,
            duration_seconds=900,
        )
        db.add(s4_active)

        db.commit()
    finally:
        db.close()

    # Test summary query
    resp = await client.get("/api/workouts/analytics/summary?time_range=4w")
    assert resp.status_code == 200
    data = resp.json()

    # Exactly 2 completed workouts (sessions 1 and 2; s3 cancelled and s4 in_progress excluded)
    assert data["total_completed_workouts"] == 2
    assert data["active_training_days"] == 2
    # Total duration = 3000 + 2400 = 5400 seconds (cancelled 1200 and active 900 excluded)
    assert data["total_training_duration_seconds"] == 5400
    assert data["average_session_duration_seconds"] == 2700
    # Total completed sets = 3 from s1 + 1 from s2 = 4 sets (skipped set in s2 excluded, s3 excluded)
    assert data["total_completed_sets"] == 4
    # Total completed reps = (10 + 10 + 10) + 8 = 38 reps
    assert data["total_completed_reps"] == 38
    # Target days per week = 3 -> 4w expected = 12 -> 2/12 = 16.7%
    assert data["target_training_days_per_week"] == 3
    assert data["consistency_percentage"] == 16.7

    # Verify exercise frequency
    freq = {item["exercise_slug"]: item["completed_count"] for item in data["exercise_frequency"]}
    assert freq.get("barbell_bench_press") == 1
    assert freq.get("pull_up") == 1


@pytest.mark.asyncio
async def test_exercise_performance_history_and_progression_logic(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Analytics User"})

    db = TestSessionLocal()
    now = datetime.now()
    try:
        profile = db.query(UserProfile).first()
        assert profile is not None

        # 1. Barbell bench press: all 3 sets completed at 80kg x 10 with target 8-10 reps
        s1 = WorkoutSessionLog(
            user_profile_id=profile.id,
            session_name="Upper Body A",
            status="completed",
            started_at=now - timedelta(days=2, hours=1),
            completed_at=now - timedelta(days=2),
            duration_seconds=3000,
        )
        db.add(s1)
        db.flush()

        ex1 = LoggedExercise(
            session_log_id=s1.id,
            order_in_session=1,
            exercise_slug="barbell_bench_press",
            exercise_name="Barbell Bench Press",
            primary_muscle="chest",
            equipment_required="barbell",
            movement_category="horizontal_push",
            target_sets=3,
            target_reps="8-10",
        )
        db.add(ex1)
        db.flush()

        for i in range(1, 4):
            db.add(
                LoggedExerciseSet(
                    logged_exercise_id=ex1.id,
                    set_number=i,
                    weight_kg=80.0,
                    reps=10,
                    is_completed=True,
                    is_skipped=False,
                )
            )

        # 2. Pull-up: target 2 sets, 1 completed and 1 skipped
        ex2 = LoggedExercise(
            session_log_id=s1.id,
            order_in_session=2,
            exercise_slug="pull_up",
            exercise_name="Pull-up",
            primary_muscle="back",
            equipment_required="bodyweight",
            movement_category="vertical_pull",
            target_sets=2,
            target_reps="8-10",
        )
        db.add(ex2)
        db.flush()

        db.add(
            LoggedExerciseSet(
                logged_exercise_id=ex2.id,
                set_number=1,
                weight_kg=None,
                reps=8,
                is_completed=True,
                is_skipped=False,
            )
        )
        db.add(
            LoggedExerciseSet(
                logged_exercise_id=ex2.id,
                set_number=2,
                weight_kg=None,
                reps=None,
                is_completed=False,
                is_skipped=True,
            )
        )

        db.commit()
    finally:
        db.close()

    # Barbell bench press query
    resp = await client.get(
        "/api/workouts/analytics/exercises/barbell_bench_press?time_range=all"
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["exercise_slug"] == "barbell_bench_press"
    assert data["best_weight_kg"] == 80.0
    assert data["best_reps_at_best_weight"] == 10
    # Epley: 80 * (1 + 10/30) = 106.7
    assert data["best_estimated_1rm_kg"] == 106.7
    assert data["is_1rm_estimate"] is True
    assert data["total_completed_sessions"] == 1
    assert data["total_completed_sets"] == 3

    rec = data["recommendation"]
    assert rec is not None
    assert rec["category"] == "increase_load"
    assert "2.5 kg" in rec["headline"] or "increase" in rec["headline"].lower()
    assert rec["is_advisory"] is True
    assert len(rec["supporting_evidence"]) > 0

    # Pull-up query
    resp_pullup = await client.get(
        "/api/workouts/analytics/exercises/pull_up?time_range=all"
    )
    assert resp_pullup.status_code == 200
    pullup_data = resp_pullup.json()

    assert pullup_data["exercise_slug"] == "pull_up"
    assert pullup_data["best_weight_kg"] is None  # Bodyweight exercise
    assert pullup_data["total_completed_sessions"] == 1
    assert pullup_data["total_completed_sets"] == 1

    pullup_rec = pullup_data["recommendation"]
    assert pullup_rec is not None
    assert pullup_rec["category"] == "review_technique_recovery"
    assert (
        "skipped" in pullup_rec["rationale"].lower()
        or "consolidate" in pullup_rec["rationale"].lower()
    )


@pytest.mark.asyncio
async def test_cross_profile_isolation(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Primary User"})

    db = TestSessionLocal()
    try:
        primary_profile = db.query(UserProfile).first()
        assert primary_profile is not None

        # Add a session to primary_profile (duration 3000s)
        s_prim = WorkoutSessionLog(
            user_profile_id=primary_profile.id,
            session_name="Primary Session",
            status="completed",
            started_at=datetime.now() - timedelta(days=2),
            completed_at=datetime.now() - timedelta(days=2),
            duration_seconds=3000,
        )
        db.add(s_prim)

        # Create a separate user profile
        other_profile = UserProfile(
            name="Other User",
            sex="female",
            height_cm=165.0,
        )
        db.add(other_profile)
        db.commit()
        db.refresh(other_profile)

        # Add a completed workout session to other_profile (duration 5000s)
        s_other = WorkoutSessionLog(
            user_profile_id=other_profile.id,
            session_name="Other User Session",
            status="completed",
            started_at=datetime.now() - timedelta(days=1),
            completed_at=datetime.now() - timedelta(days=1),
            duration_seconds=5000,
        )
        db.add(s_other)
        db.commit()
    finally:
        db.close()

    # Query analytics for the default profile
    resp = await client.get("/api/workouts/analytics/summary?time_range=all")
    assert resp.status_code == 200
    data = resp.json()

    # Should only include primary_profile's session duration (3000s), NOT other_profile's (5000s)
    assert data["total_training_duration_seconds"] == 3000
    assert data["total_completed_workouts"] == 1
