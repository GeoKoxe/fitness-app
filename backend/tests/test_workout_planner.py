import pytest
from httpx import AsyncClient

from app.db.seed_exercises import seed_built_in_exercises
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def seed_exercises_db():
    db = TestSessionLocal()
    try:
        seed_built_in_exercises(db)
    finally:
        db.close()


@pytest.mark.asyncio
async def test_generate_plan_without_user_profile_fails(client: AsyncClient):
    """Attempting to generate a plan when no user profile exists returns 400."""
    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 400
    assert "User profile not found" in res.json()["detail"]


@pytest.mark.asyncio
async def test_generate_plan_full_body_3day(client: AsyncClient):
    """Test generating a 3-day Full Body plan with explicit rest days."""
    # 1. Create user profile
    await client.post("/api/profile", json={"name": "Chris", "activity_level": "moderately_active"})

    # 2. Configure training profile: 3 days (Mon, Wed, Fri)
    profile_payload = {
        "experience_level": "beginner",
        "training_goals": ["general_fitness"],
        "available_days": ["monday", "wednesday", "friday"],
        "preferred_duration_minutes": 60,
        "available_equipment": ["barbell", "dumbbell", "bodyweight", "bench"],
    }
    await client.put("/api/workouts/profile", json=profile_payload)

    # 3. Generate plan
    res = await client.post("/api/workouts/plans/generate", json={"name": "Chris Beginner Routine"})
    assert res.status_code == 201
    plan = res.json()

    assert plan["is_active"] is True
    assert plan["split_type"] == "full_body"
    assert len(plan["sessions"]) == 7

    # Verify sessions
    active_days = set()
    rest_days = set()
    for s in plan["sessions"]:
        if s["is_rest_day"]:
            rest_days.add(s["day_of_week_name"])
            assert len(s["exercises"]) == 0
            assert "Recovery" in s["session_focus"]
        else:
            active_days.add(s["day_of_week_name"])
            assert len(s["exercises"]) == 5  # 60 min -> 5 exercises
            # Check exercise snapshots and prescriptions
            for ex in s["exercises"]:
                assert ex["exercise_name"]
                assert ex["primary_muscle"]
                assert ex["target_sets"] == 3
                assert ex["target_reps"]
                assert ex["rest_seconds"] > 0
                assert "Linear progression" in ex["progression_notes"]

    assert active_days == {"monday", "wednesday", "friday"}
    assert rest_days == {"tuesday", "thursday", "saturday", "sunday"}


@pytest.mark.asyncio
async def test_generate_plan_upper_lower_4day_consecutive_rotation(client: AsyncClient):
    """Test 4-day Upper/Lower plan with alternating consecutive days (Mon/Tue and Thu/Fri)."""
    await client.post("/api/profile", json={"name": "Dana"})

    profile_payload = {
        "experience_level": "intermediate",
        "training_goals": ["hypertrophy"],
        "available_days": ["monday", "tuesday", "thursday", "friday"],
        "preferred_duration_minutes": 60,
        "available_equipment": ["barbell", "dumbbell", "cable", "machine", "bench", "bodyweight"],
    }
    await client.put("/api/workouts/profile", json=profile_payload)

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 201
    plan = res.json()

    assert plan["split_type"] == "upper_lower"
    sessions_by_day = {s["day_of_week_name"]: s for s in plan["sessions"]}

    # Mon & Thu are Upper; Tue & Fri are Lower
    assert "Upper" in sessions_by_day["monday"]["session_name"]
    assert "Lower" in sessions_by_day["tuesday"]["session_name"]
    assert sessions_by_day["wednesday"]["is_rest_day"] is True
    assert "Upper" in sessions_by_day["thursday"]["session_name"]
    assert "Lower" in sessions_by_day["friday"]["session_name"]
    assert sessions_by_day["saturday"]["is_rest_day"] is True
    assert sessions_by_day["sunday"]["is_rest_day"] is True

    # Intermediate hypertrophy should have double progression notes
    first_ex = sessions_by_day["monday"]["exercises"][0]
    assert "Double progression" in first_ex["progression_notes"]


@pytest.mark.asyncio
async def test_equipment_and_exclusions_respected(client: AsyncClient):
    """Test that only available equipment is used and excluded exercises/muscles never appear."""
    await client.post("/api/profile", json={"name": "Taylor"})

    profile_payload = {
        "experience_level": "beginner",
        "training_goals": ["general_fitness"],
        "available_days": ["monday", "wednesday", "friday"],
        "preferred_duration_minutes": 45,
        "available_equipment": ["bodyweight"],  # Only bodyweight equipment
        "excluded_exercises": ["push_up"],      # Push-up specifically excluded
        "excluded_muscle_groups": ["calves"],   # Calves excluded
    }
    await client.put("/api/workouts/profile", json=profile_payload)

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 201
    plan = res.json()

    all_planned_exercises = [
        ex
        for s in plan["sessions"]
        for ex in s["exercises"]
    ]

    for ex in all_planned_exercises:
        # 1. Equipment must be bodyweight
        assert ex["equipment_required"] == "bodyweight"
        # 2. Excluded slug must never appear
        assert ex["exercise_slug"] != "push_up"
        # 3. Excluded muscle must never appear
        assert ex["primary_muscle"] != "calves"


@pytest.mark.asyncio
async def test_session_duration_scaling(client: AsyncClient):
    """Test that preferred duration scales the number of exercise slots per session."""
    await client.post("/api/profile", json={"name": "Jordan"})

    # 30 min duration -> 3 slots
    await client.put(
        "/api/workouts/profile",
        json={
            "available_days": ["monday", "wednesday", "friday"],
            "preferred_duration_minutes": 30,
            "available_equipment": ["barbell", "dumbbell", "bodyweight", "bench"],
        },
    )
    res_short = await client.post("/api/workouts/plans/generate", json={})
    assert res_short.status_code == 201
    mon_session_short = [s for s in res_short.json()["sessions"] if not s["is_rest_day"]][0]
    assert len(mon_session_short["exercises"]) == 3

    # 75 min duration -> 6 slots
    await client.put(
        "/api/workouts/profile",
        json={"preferred_duration_minutes": 75},
    )
    res_long = await client.post("/api/workouts/plans/generate", json={})
    assert res_long.status_code == 201
    mon_session_long = [s for s in res_long.json()["sessions"] if not s["is_rest_day"]][0]
    assert len(mon_session_long["exercises"]) == 6


@pytest.mark.asyncio
async def test_plan_generation_deterministic(client: AsyncClient):
    """Test that identical training profile and catalogue produce the exact same plan."""
    await client.post("/api/profile", json={"name": "Morgan"})

    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "intermediate",
            "training_goals": ["strength", "hypertrophy"],
            "available_days": ["monday", "wednesday", "friday"],
            "preferred_duration_minutes": 60,
            "available_equipment": ["barbell", "dumbbell", "bench", "bodyweight"],
        },
    )

    # First generation
    res1 = await client.post("/api/workouts/plans/generate", json={})
    plan1 = res1.json()

    # Second generation
    res2 = await client.post("/api/workouts/plans/generate", json={})
    plan2 = res2.json()

    # Compare planned exercise sequence across all active sessions
    for s1, s2 in zip(plan1["sessions"], plan2["sessions"]):
        assert s1["day_of_week_name"] == s2["day_of_week_name"]
        assert s1["is_rest_day"] == s2["is_rest_day"]
        slugs1 = [e["exercise_slug"] for e in s1["exercises"]]
        slugs2 = [e["exercise_slug"] for e in s2["exercises"]]
        assert slugs1 == slugs2


@pytest.mark.asyncio
async def test_historical_plan_preservation(client: AsyncClient):
    """Generating a new plan preserves the prior plan as inactive in history."""
    await client.post("/api/profile", json={"name": "Riley"})
    await client.put(
        "/api/workouts/profile",
        json={
            "available_days": ["monday", "wednesday", "friday"],
            "available_equipment": ["barbell", "dumbbell", "bodyweight"],
        },
    )

    # Plan 1
    res1 = await client.post("/api/workouts/plans/generate", json={"name": "Week 1 Plan"})
    plan1_id = res1.json()["id"]

    # Plan 2
    res2 = await client.post("/api/workouts/plans/generate", json={"name": "Week 2 Plan"})
    plan2_id = res2.json()["id"]

    # Active plan endpoint returns Plan 2
    active_res = await client.get("/api/workouts/plans/active")
    assert active_res.status_code == 200
    assert active_res.json()["id"] == plan2_id
    assert active_res.json()["is_active"] is True

    # History list includes both
    history_res = await client.get("/api/workouts/plans")
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) == 2
    ids = [p["id"] for p in history]
    assert plan2_id in ids and plan1_id in ids

    # Plan 1 can still be retrieved with full exercise snapshots and is_active=False
    p1_res = await client.get(f"/api/workouts/plans/{plan1_id}")
    assert p1_res.status_code == 200
    p1_data = p1_res.json()
    assert p1_data["is_active"] is False
    assert len(p1_data["sessions"]) == 7


@pytest.mark.asyncio
async def test_impossible_preferences_raise_clear_error(client: AsyncClient):
    """If preferences make generating a valid routine impossible, return clear 400 error."""
    await client.post("/api/profile", json={"name": "Casey"})

    from app.schemas.exercise import VALID_PRIMARY_MUSCLES

    # Excluding all primary muscles leaves no eligible exercises
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
    assert "Limiting constraints" in res.json()["detail"] or "No exercises found" in res.json()["detail"]


@pytest.mark.asyncio
async def test_replace_and_regenerate_planned_exercise(client: AsyncClient):
    """Test replacing and regenerating a planned exercise slot."""
    await client.post("/api/profile", json={"name": "Devon"})
    await client.put(
        "/api/workouts/profile",
        json={
            "available_days": ["monday", "wednesday", "friday"],
            "available_equipment": ["barbell", "dumbbell", "bench", "bodyweight"],
        },
    )

    gen_res = await client.post("/api/workouts/plans/generate", json={})
    plan = gen_res.json()
    plan_id = plan["id"]

    active_session = [s for s in plan["sessions"] if not s["is_rest_day"]][0]
    first_exercise = active_session["exercises"][0]
    target_slot_id = first_exercise["id"]

    # 1. Get compatible alternatives
    alt_res = await client.get(
        f"/api/workouts/plans/{plan_id}/exercises/{target_slot_id}/alternatives"
    )
    assert alt_res.status_code == 200
    alts = alt_res.json()["compatible_alternatives"]
    assert len(alts) > 0

    replacement_exercise_id = alts[0]["id"]

    # 2. Replace exercise
    rep_res = await client.put(
        f"/api/workouts/plans/{plan_id}/exercises/{target_slot_id}/replace",
        json={"new_exercise_id": replacement_exercise_id},
    )
    assert rep_res.status_code == 200
    updated_plan = rep_res.json()

    # Find the updated exercise slot
    updated_session = [s for s in updated_plan["sessions"] if s["id"] == active_session["id"]][0]
    updated_ex = [e for e in updated_session["exercises"] if e["id"] == target_slot_id][0]
    assert updated_ex["exercise_id"] == replacement_exercise_id
    assert updated_ex["exercise_name"] == alts[0]["name"]

    # 3. Regenerate exercise
    regen_res = await client.post(
        f"/api/workouts/plans/{plan_id}/exercises/{target_slot_id}/regenerate"
    )
    assert regen_res.status_code == 200

