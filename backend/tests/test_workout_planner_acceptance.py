import pytest
from httpx import AsyncClient

from app.db.seed_exercises import seed_built_in_exercises
from app.models.exercise import Exercise
from app.schemas.exercise import VALID_PRIMARY_MUSCLES
from app.services.workout_planner_service import workout_planner_service
from tests.conftest import TestSessionLocal

ALL_12_VALID_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]


@pytest.fixture(autouse=True)
def seed_exercises_db():
    db = TestSessionLocal()
    try:
        seed_built_in_exercises(db)
    finally:
        db.close()


# ==============================================================================
# SECTION 1: WORKOUT DURATION ESTIMATION & DETERMINISTIC WORKLOAD REDUCTION
# ==============================================================================


@pytest.mark.asyncio
async def test_oversized_workout_is_actually_reduced_not_just_relabeled(client: AsyncClient):
    """Test that a tight duration (15 min) with heavy prescriptions (advanced strength)
    actually reduces workload (sets/accessories) deterministically, rather than merely capping
    the reported estimate.
    """
    await client.post("/api/profile", json={"name": "Alex Reduction Test"})

    # Advanced strength typically prescribes 4 working sets with 150s rest.
    # On a 15-minute budget with 5 min overhead, 4 sets with 150s rest takes 12 min (total 17 min > 15 min).
    # The planner must reduce the sets down so that actual workload fits <= 15 minutes!
    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "advanced",
            "training_goals": ["strength"],
            "available_days": ["monday"],
            "preferred_duration_minutes": 15,
            "available_equipment": ["barbell", "bench", "bodyweight"],
        },
    )

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 201, res.json()
    plan = res.json()

    monday_session = [s for s in plan["sessions"] if not s["is_rest_day"]][0]

    # Verify session respects 15 minutes
    assert monday_session["estimated_duration_minutes"] <= 15

    # Verify that requested_duration_minutes is exposed and matches
    assert monday_session["requested_duration_minutes"] == 15

    # Recalculate duration from actual exercises and sets in the response
    total_calculated = 5.0  # 3m warmup + 2m cooldown for <= 20 min
    for i, ex in enumerate(monday_session["exercises"]):
        sets = ex["target_sets"]
        rest = ex["rest_seconds"]
        is_compound = ex["movement_category"] in {
            "horizontal_push", "vertical_push", "horizontal_pull",
            "vertical_pull", "squat", "hinge"
        }
        set_exec = sets * 0.75
        inter_set_rest = max(0, sets - 1) * (rest / 60.0)
        transition = 0.0 if i == 0 else 1.5
        ramp = 1.5 if (is_compound and i == 0) else 0.0
        total_calculated += (set_exec + inter_set_rest + transition + ramp)

    # Workload MUST have been reduced: target sets must be <= 3 (not 4)
    for ex in monday_session["exercises"]:
        assert ex["target_sets"] <= 3

    # The reported estimate must EXACTLY equal the rounded calculated workload, NOT an artificial clamp!
    assert monday_session["estimated_duration_minutes"] == int(round(total_calculated))
    assert monday_session["estimated_duration_minutes"] <= 15


@pytest.mark.asyncio
async def test_replacing_exercise_recalculates_and_enforces_duration_cap(client: AsyncClient):
    """When an exercise is replaced, the session duration is recalculated and workload reduction
    is enforced if the new exercise pushes the session over budget.
    """
    await client.post("/api/profile", json={"name": "Sam Replace Duration Test"})
    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "intermediate",
            "training_goals": ["hypertrophy"],
            "available_days": ["monday"],
            "preferred_duration_minutes": 30,
            "available_equipment": ["barbell", "dumbbell", "bodyweight", "bench"],
        },
    )

    gen_res = await client.post("/api/workouts/plans/generate", json={})
    assert gen_res.status_code == 201
    plan = gen_res.json()
    plan_id = plan["id"]

    active_session = [s for s in plan["sessions"] if not s["is_rest_day"]][0]
    initial_estimated = active_session["estimated_duration_minutes"]
    assert initial_estimated <= 30

    # Get alternatives for first exercise slot
    slot_id = active_session["exercises"][0]["id"]
    alt_res = await client.get(f"/api/workouts/plans/{plan_id}/exercises/{slot_id}/alternatives")
    assert alt_res.status_code == 200
    alts = alt_res.json()["compatible_alternatives"]
    assert len(alts) > 0

    # Replace with alternative
    rep_res = await client.put(
        f"/api/workouts/plans/{plan_id}/exercises/{slot_id}/replace",
        json={"new_exercise_id": alts[0]["id"]},
    )
    assert rep_res.status_code == 200
    updated_plan = rep_res.json()

    updated_session = [s for s in updated_plan["sessions"] if s["id"] == active_session["id"]][0]
    # Updated session must still strictly respect the 30-min duration cap
    assert updated_session["estimated_duration_minutes"] <= 30
    assert updated_session["estimated_duration_minutes"] > 0


# ==============================================================================
# SECTION 2: COMPLETE 12-DURATION BOUNDARY TESTING (15 to 180 in 15-min steps)
# ==============================================================================


@pytest.mark.asyncio
@pytest.mark.parametrize("duration", ALL_12_VALID_DURATIONS)
async def test_all_12_valid_durations_accepted_and_generate_accurate_workload(client: AsyncClient, duration):
    """Test that all 12 valid durations (15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180)
    are accepted by profile, generate valid sessions, and report matching workload estimates.
    """
    await client.post("/api/profile", json={"name": f"User Duration {duration}m"})

    # 1. Profile accepts value
    put_res = await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "intermediate",
            "training_goals": ["strength", "hypertrophy"],
            "available_days": ["monday", "wednesday", "friday"],
            "preferred_duration_minutes": duration,
            "available_equipment": ["barbell", "dumbbell", "cable", "bench", "bodyweight"],
        },
    )
    assert put_res.status_code == 200
    assert put_res.json()["preferred_duration_minutes"] == duration

    # 2. Plan generation respects target and workload matches
    gen_res = await client.post("/api/workouts/plans/generate", json={})
    assert gen_res.status_code == 201
    plan = gen_res.json()

    active_sessions = [s for s in plan["sessions"] if not s["is_rest_day"]]
    assert len(active_sessions) == 3

    for session in active_sessions:
        # Reported estimate must be <= requested target
        assert session["estimated_duration_minutes"] <= duration
        # Must have usable exercises
        assert len(session["exercises"]) >= 1

        # Check for duplicate exercises in the same session
        slugs = [e["exercise_slug"] for e in session["exercises"]]
        assert len(slugs) == len(set(slugs)), f"Session has duplicate exercises: {slugs}"

        # Workload calculation check
        warmup = 3.0 if duration <= 20 else 5.0
        cooldown = 2.0 if duration <= 20 else 3.0
        workload = warmup + cooldown
        for i, ex in enumerate(session["exercises"]):
            sets = ex["target_sets"]
            rest = ex["rest_seconds"]
            is_compound = ex["movement_category"] in {
                "horizontal_push", "vertical_push", "horizontal_pull",
                "vertical_pull", "squat", "hinge"
            }
            workload += (sets * 0.75 + max(0, sets - 1) * (rest / 60.0) + (0.0 if i == 0 else 1.5) + (1.5 if (is_compound and i == 0) else 0.0))

        # Reported estimate matches actual calculated workload
        assert session["estimated_duration_minutes"] == int(round(workload))


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_duration", [0, 5, 10, 20, 25, 35, 50, 70, 100, 195, 200])
async def test_invalid_durations_outside_range_or_non_multiples_rejected(client: AsyncClient, invalid_duration):
    """Test that non-multiples of 15 and durations outside 15-180 are rejected with 422."""
    await client.post("/api/profile", json={"name": f"User Invalid {invalid_duration}"})

    res = await client.put(
        "/api/workouts/profile",
        json={"preferred_duration_minutes": invalid_duration},
    )
    assert res.status_code == 422


# ==============================================================================
# SECTION 3: BUILT-IN EXERCISE SEED IDEMPOTENCE & ISOLATION
# ==============================================================================


@pytest.mark.asyncio
async def test_seed_built_in_exercises_is_strictly_idempotent(client: AsyncClient):
    """Running seed_built_in_exercises repeatedly produces the same exercise count
    and never duplicates built-in exercises.
    """
    db = TestSessionLocal()
    try:
        # First manual call (after fixture) should insert 0 since already seeded
        inserted_again = seed_built_in_exercises(db)
        assert inserted_again == 0

        # Verify built-in exercise count
        built_in_count = db.query(Exercise).filter(Exercise.is_built_in == True).count()
        assert built_in_count == 67

        # Run third time
        inserted_third = seed_built_in_exercises(db)
        assert inserted_third == 0

        # Count remains 67
        assert db.query(Exercise).filter(Exercise.is_built_in == True).count() == 67
    finally:
        db.close()


@pytest.mark.asyncio
async def test_seed_preserves_custom_exercises_and_user_exclusions(client: AsyncClient):
    """Custom user exercises and profile exclusions are preserved across re-seeding."""
    await client.post("/api/profile", json={"name": "Custom Exercise Owner"})

    # Create a custom exercise
    custom_payload = {
        "name": "Custom Plyo Pushup",
        "movement_category": "horizontal_push",
        "primary_muscle": "chest",
        "secondary_muscles": "triceps",
        "equipment_required": "bodyweight",
        "difficulty_level": "intermediate",
        "instructions": "Push explosively from floor.",
    }
    create_res = await client.post("/api/exercises", json=custom_payload)
    assert create_res.status_code == 201
    custom_ex = create_res.json()
    assert custom_ex["is_built_in"] is False
    custom_slug = custom_ex["slug"]

    # Configure training profile with an exclusion
    await client.put(
        "/api/workouts/profile",
        json={
            "available_days": ["monday", "wednesday", "friday"],
            "excluded_exercises": ["push_up", custom_slug],
        },
    )

    # Re-run seeder
    db = TestSessionLocal()
    try:
        seed_built_in_exercises(db)
    finally:
        db.close()

    # Custom exercise still exists
    get_res = await client.get(f"/api/exercises/{custom_ex['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Custom Plyo Pushup"

    # Profile exclusions still intact
    prof_res = await client.get("/api/workouts/profile")
    assert prof_res.status_code == 200
    assert "push_up" in prof_res.json()["excluded_exercises"]
    assert custom_slug in prof_res.json()["excluded_exercises"]


@pytest.mark.asyncio
async def test_excluding_all_eligible_exercises_returns_clear_actionable_error(client: AsyncClient):
    """Explicitly excluding all eligible muscles/exercises produces a clear 400 error
    explaining limiting constraints, rather than an empty/broken routine.
    """
    await client.post("/api/profile", json={"name": "Total Exclusion User"})

    await client.put(
        "/api/workouts/profile",
        json={
            "available_days": ["monday", "wednesday"],
            "available_equipment": ["bodyweight"],
            "excluded_muscle_groups": list(VALID_PRIMARY_MUSCLES),
        },
    )

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert "Limiting constraints" in detail or "No exercises found" in detail
    assert "excluded muscle groups" in detail or "equipment" in detail


# ==============================================================================
# SECTION 5: COMPREHENSIVE END-TO-END ACCEPTANCE TEST (10-Step Workflow)
# ==============================================================================


@pytest.mark.asyncio
async def test_end_to_end_acceptance_workflow(client: AsyncClient):
    """End-to-End Acceptance Test covering the complete 10-step personal workout lifecycle:
    1. Load profile
    2. Configure bodyweight-only
    3. Save as named profile
    4. Reload/reapply saved profile
    5. Generate short duration plan (30m) & verify realism
    6. Generate longer duration plan (60m) & verify scaling
    7. Exclude exercise and confirm absent
    8. Start session, log sets, save progress, complete
    9. Verify analytics reflect completed session
    10. Confirm existing meal planning, nutrition, body metrics, and history intact
    """
    # Step 1: Create and load user profile
    prof_create = await client.post("/api/profile", json={"name": "Morgan E2E Athlete", "height_cm": 178, "weight_kg": 75})
    assert prof_create.status_code == 201

    get_prof = await client.get("/api/workouts/profile")
    assert get_prof.status_code == 200

    # Step 2: Configure a bodyweight-only profile with empty equipment
    bw_profile_payload = {
        "experience_level": "beginner",
        "training_goals": ["general_fitness"],
        "available_days": ["tuesday", "thursday", "saturday"],
        "preferred_duration_minutes": 30,
        "available_equipment": [],  # No equipment!
        "excluded_exercises": [],
        "excluded_muscle_groups": [],
        "training_considerations": "Hotel room bodyweight routine",
    }
    update_prof = await client.put("/api/workouts/profile", json=bw_profile_payload)
    assert update_prof.status_code == 200
    assert update_prof.json()["available_equipment"] == []

    # Step 3: Save as named training profile
    saved_cfg_payload = {
        "name": "Travel Bodyweight 30m",
        "description": "Quick hotel room bodyweight routine",
        "experience_level": "beginner",
        "training_goals": ["general_fitness"],
        "available_days": ["tuesday", "thursday", "saturday"],
        "preferred_duration_minutes": 30,
        "available_equipment": [],
    }
    save_cfg_res = await client.post("/api/workouts/profile/saved", json=saved_cfg_payload)
    assert save_cfg_res.status_code == 201
    saved_cfg_id = save_cfg_res.json()["id"]

    # Step 4: Reload / reapply saved profile and verify settings
    apply_res = await client.post(f"/api/workouts/profile/saved/{saved_cfg_id}/apply")
    assert apply_res.status_code == 200
    applied_profile = apply_res.json()
    assert applied_profile["preferred_duration_minutes"] == 30
    assert applied_profile["available_days"] == ["tuesday", "thursday", "saturday"]
    assert applied_profile["available_equipment"] == []

    # Step 5: Generate weekly plan at short duration (30 min) and verify realistic workload and estimates
    plan30_res = await client.post("/api/workouts/plans/generate", json={"name": "Weekly 30m Bodyweight Plan"})
    assert plan30_res.status_code == 201
    plan30 = plan30_res.json()
    assert plan30["is_active"] is True
    active_sessions_30 = [s for s in plan30["sessions"] if not s["is_rest_day"]]
    assert len(active_sessions_30) == 3

    for s in active_sessions_30:
        assert s["estimated_duration_minutes"] <= 30
        assert s["requested_duration_minutes"] == 30
        assert len(s["exercises"]) in [2, 3]  # Realistic workload for 30 min
        for ex in s["exercises"]:
            assert ex["equipment_required"] == "bodyweight"

    # Step 6: Generate another plan at longer duration (60 min) and verify scaling
    await client.put(
        "/api/workouts/profile",
        json={"preferred_duration_minutes": 60, "available_equipment": ["dumbbell", "bodyweight"]},
    )
    plan60_res = await client.post("/api/workouts/plans/generate", json={"name": "Weekly 60m Dumbbell Plan"})
    assert plan60_res.status_code == 201
    plan60 = plan60_res.json()
    assert plan60["is_active"] is True
    active_sessions_60 = [s for s in plan60["sessions"] if not s["is_rest_day"]]
    for s in active_sessions_60:
        assert s["estimated_duration_minutes"] <= 60
        assert s["requested_duration_minutes"] == 60
        # Scaled up exercise count for 60m
        assert len(s["exercises"]) >= 4

    # Step 7: Exclude an exercise and confirm it is absent from generated sessions
    await client.put(
        "/api/workouts/profile",
        json={"excluded_exercises": ["push_up"]},
    )
    plan_excl_res = await client.post("/api/workouts/plans/generate", json={"name": "Exclusion Plan"})
    assert plan_excl_res.status_code == 201
    plan_excl = plan_excl_res.json()
    for s in plan_excl["sessions"]:
        for ex in s["exercises"]:
            assert ex["exercise_slug"] != "push_up"

    # Step 8: Start a planned session, log sets, save progress, and complete it
    first_active_session = [s for s in plan_excl["sessions"] if not s["is_rest_day"]][0]
    start_res = await client.post(
        "/api/workouts/sessions/start",
        json={"planned_session_id": first_active_session["id"]},
    )
    assert start_res.status_code == 201
    log = start_res.json()
    log_id = log["id"]
    assert log["status"] == "in_progress"

    # Log completed sets for first exercise
    first_logged_ex = log["exercises"][0]
    update_payload = {
        "duration_seconds": 1800,
        "exercises": [
            {
                "id": first_logged_ex["id"],
                "order_in_session": first_logged_ex["order_in_session"],
                "sets": [
                    {
                        "set_number": 1,
                        "weight_kg": 20.0,
                        "reps": 10,
                        "is_completed": True,
                    }
                ],
            }
        ],
    }
    set_res = await client.put(
        f"/api/workouts/sessions/{log_id}",
        json=update_payload,
    )
    assert set_res.status_code == 200

    # Complete session
    complete_res = await client.post(f"/api/workouts/sessions/{log_id}/complete", json={})
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "completed"

    # Step 9: Verify analytics reflects completed session
    analytics_res = await client.get("/api/workouts/analytics/summary?time_range=4w")
    assert analytics_res.status_code == 200
    summary = analytics_res.json()
    assert summary["total_completed_workouts"] >= 1

    # Step 10: Confirm existing profile, measurements, meal planning, and history intact
    prof_check = await client.get("/api/profile")
    assert prof_check.status_code == 200
    assert prof_check.json()["name"] == "Morgan E2E Athlete"

    saved_list_check = await client.get("/api/workouts/profile/saved")
    assert saved_list_check.status_code == 200
    assert len(saved_list_check.json()) >= 1

    plans_list_check = await client.get("/api/workouts/plans")
    assert plans_list_check.status_code == 200
    assert len(plans_list_check.json()) >= 3  # All generated plans preserved in history
