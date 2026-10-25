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
async def test_bodyweight_only_generation_succeeds_with_empty_equipment(client: AsyncClient):
    """When available_equipment is empty, generation must succeed using bodyweight exercises."""
    await client.post("/api/profile", json={"name": "Bodyweight Only Athlete"})

    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "beginner",
            "training_goals": ["general_fitness"],
            "available_days": ["monday", "wednesday", "friday"],
            "preferred_duration_minutes": 45,
            "available_equipment": [],  # Empty equipment!
            "excluded_exercises": [],
            "excluded_muscle_groups": [],
        },
    )

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 201, res.json()
    plan = res.json()
    assert plan["is_active"] is True
    assert len(plan["sessions"]) == 7

    active_sessions = [s for s in plan["sessions"] if not s["is_rest_day"]]
    assert len(active_sessions) == 3

    for session in active_sessions:
        assert session["estimated_duration_minutes"] <= 45
        assert len(session["exercises"]) > 0
        for ex in session["exercises"]:
            assert ex["equipment_required"] == "bodyweight"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "days_list",
    [
        ["wednesday"],  # 1 day
        ["tuesday", "thursday"],  # 2 days
        ["monday", "wednesday", "friday"],  # 3 days
        ["monday", "tuesday", "thursday", "friday"],  # 4 days
        ["monday", "tuesday", "wednesday", "friday", "saturday"],  # 5 days
        ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],  # 6 days
        ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],  # 7 days
    ],
)
async def test_every_day_count_1_to_7_generates_valid_routine(client: AsyncClient, days_list):
    """Test generating valid routines for 1 through 7 training days."""
    await client.post("/api/profile", json={"name": f"User {len(days_list)} Days"})

    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "intermediate",
            "training_goals": ["hypertrophy"],
            "available_days": days_list,
            "preferred_duration_minutes": 60,
            "available_equipment": ["barbell", "dumbbell", "bodyweight", "bench"],
        },
    )

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 201, res.json()
    plan = res.json()

    active_sessions = [s for s in plan["sessions"] if not s["is_rest_day"]]
    assert len(active_sessions) == len(days_list)

    for session in active_sessions:
        assert session["day_of_week_name"] in days_list
        assert session["estimated_duration_minutes"] <= 60
        assert len(session["exercises"]) > 0


@pytest.mark.asyncio
@pytest.mark.parametrize("duration", [15, 30, 45, 60, 75, 90, 120, 180])
async def test_durations_15_to_180_enforce_maximum_duration_cap(client: AsyncClient, duration):
    """Test that every duration from 15 to 180 min enforces estimated_duration_minutes <= preferred_duration_minutes."""
    await client.post("/api/profile", json={"name": f"User Dur {duration}"})

    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "advanced",
            "training_goals": ["strength", "hypertrophy"],
            "available_days": ["monday", "wednesday", "friday"],
            "preferred_duration_minutes": duration,
            "available_equipment": ["barbell", "dumbbell", "cable", "bench", "bodyweight"],
        },
    )

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 201, res.json()
    plan = res.json()

    for s in plan["sessions"]:
        if not s["is_rest_day"]:
            assert s["estimated_duration_minutes"] <= duration
            assert len(s["exercises"]) > 0


@pytest.mark.asyncio
@pytest.mark.parametrize("experience_level", ["beginner", "intermediate", "advanced"])
async def test_all_experience_levels_produce_valid_routines(client: AsyncClient, experience_level):
    """Test that beginner, intermediate, and advanced experience levels generate appropriate routines."""
    await client.post("/api/profile", json={"name": f"User {experience_level}"})

    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": experience_level,
            "training_goals": ["strength"],
            "available_days": ["monday", "wednesday", "friday"],
            "preferred_duration_minutes": 45,
            "available_equipment": ["barbell", "dumbbell", "bodyweight"],
        },
    )

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 201, res.json()
    plan = res.json()

    for s in plan["sessions"]:
        if not s["is_rest_day"]:
            assert s["estimated_duration_minutes"] <= 45
            for ex in s["exercises"]:
                if experience_level == "beginner":
                    assert "Linear progression" in ex["progression_notes"]
                elif experience_level == "intermediate":
                    assert "Double progression" in ex["progression_notes"]
                elif experience_level == "advanced":
                    assert "RPE" in ex["progression_notes"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "goals",
    [
        ["strength"],
        ["hypertrophy"],
        ["endurance"],
        ["general_fitness"],
        ["strength", "hypertrophy"],
        ["endurance", "general_fitness"],
        ["strength", "hypertrophy", "endurance", "general_fitness"],
    ],
)
async def test_all_goal_combinations_produce_valid_routines(client: AsyncClient, goals):
    """Test all goal single and multi-selections produce valid routines."""
    await client.post("/api/profile", json={"name": f"Goals {'-'.join(goals)}"})

    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "intermediate",
            "training_goals": goals,
            "available_days": ["monday", "thursday"],
            "preferred_duration_minutes": 60,
            "available_equipment": ["dumbbell", "bodyweight", "bench"],
        },
    )

    res = await client.post("/api/workouts/plans/generate", json={})
    assert res.status_code == 201, res.json()
    plan = res.json()
    for s in plan["sessions"]:
        if not s["is_rest_day"]:
            assert s["estimated_duration_minutes"] <= 60


@pytest.mark.asyncio
async def test_three_successive_plan_generations_across_configurations(client: AsyncClient):
    """Generate 3 successive plans across varied profile configurations.
    Confirm stability, verify active flag correctly tracks the current plan,
    and prior plans remain preserved as inactive.
    """
    await client.post("/api/profile", json={"name": "Successive Planner Test"})

    configs = [
        {
            "name": "Config 1: 3-Day Bodyweight",
            "experience_level": "beginner",
            "training_goals": ["general_fitness"],
            "available_days": ["monday", "wednesday", "friday"],
            "preferred_duration_minutes": 30,
            "available_equipment": [],
            "excluded_exercises": [],
            "excluded_muscle_groups": [],
        },
        {
            "name": "Config 2: 4-Day Intermediate Upper/Lower",
            "experience_level": "intermediate",
            "training_goals": ["hypertrophy"],
            "available_days": ["monday", "tuesday", "thursday", "friday"],
            "preferred_duration_minutes": 60,
            "available_equipment": ["barbell", "dumbbell", "bench", "bodyweight"],
            "excluded_exercises": ["push_up"],
            "excluded_muscle_groups": ["calves"],
        },
        {
            "name": "Config 3: 5-Day Advanced Strength",
            "experience_level": "advanced",
            "training_goals": ["strength"],
            "available_days": ["monday", "tuesday", "wednesday", "friday", "saturday"],
            "preferred_duration_minutes": 90,
            "available_equipment": ["barbell", "dumbbell", "cable", "bench", "bodyweight"],
            "excluded_exercises": [],
            "excluded_muscle_groups": [],
        },
    ]

    generated_plan_ids = []

    for i, cfg in enumerate(configs):
        # Update profile
        await client.put("/api/workouts/profile", json=cfg)

        # Generate plan
        res = await client.post("/api/workouts/plans/generate", json={"name": f"Weekly Plan Batch {i+1}"})
        assert res.status_code == 201
        plan = res.json()
        assert plan["is_active"] is True
        assert plan["name"] == f"Weekly Plan Batch {i+1}"
        generated_plan_ids.append(plan["id"])

        # Verify active plan endpoint returns this exact plan
        active_res = await client.get("/api/workouts/plans/active")
        assert active_res.status_code == 200
        assert active_res.json()["id"] == plan["id"]

        # Verify duration constraint
        for s in plan["sessions"]:
            if not s["is_rest_day"]:
                assert s["estimated_duration_minutes"] <= cfg["preferred_duration_minutes"]
                assert len(s["exercises"]) > 0

                # Equipment & exclusion constraints
                for ex in s["exercises"]:
                    if cfg["available_equipment"]:
                        allowed = set(cfg["available_equipment"]) | {"bodyweight"}
                        assert ex["equipment_required"] in allowed
                    else:
                        assert ex["equipment_required"] == "bodyweight"

                    if cfg["excluded_exercises"]:
                        assert ex["exercise_slug"] not in cfg["excluded_exercises"]
                    if cfg["excluded_muscle_groups"]:
                        assert ex["primary_muscle"] not in cfg["excluded_muscle_groups"]

        # Prior plans must now be inactive
        for prior_id in generated_plan_ids[:-1]:
            prior_res = await client.get(f"/api/workouts/plans/{prior_id}")
            assert prior_res.status_code == 200
            assert prior_res.json()["is_active"] is False

    # Check plan history list
    list_res = await client.get("/api/workouts/plans")
    assert list_res.status_code == 200
    all_plans = list_res.json()
    assert len(all_plans) >= 3
    # Exactly one plan is active
    active_in_list = [p for p in all_plans if p["is_active"]]
    assert len(active_in_list) == 1
    assert active_in_list[0]["id"] == generated_plan_ids[-1]
