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
async def test_start_session_from_planned_workout(client: AsyncClient):
    """Start a session from a planned workout, verifying linking, snapshots, and set pre-population."""
    # 1. Create user and profile
    await client.post("/api/profile", json={"name": "Alex Workout"})
    await client.put(
        "/api/workouts/profile",
        json={
            "experience_level": "intermediate",
            "available_days": ["monday", "wednesday", "friday"],
            "preferred_duration_minutes": 60,
            "available_equipment": ["barbell", "dumbbell", "bench", "bodyweight"],
        },
    )

    # 2. Generate plan
    plan_res = await client.post("/api/workouts/plans/generate", json={})
    assert plan_res.status_code == 201
    plan = plan_res.json()

    # Find first active session
    mon_session = [s for s in plan["sessions"] if not s["is_rest_day"]][0]
    planned_session_id = mon_session["id"]

    # 3. Start session
    start_res = await client.post(
        "/api/workouts/sessions/start",
        json={"planned_session_id": planned_session_id},
    )
    assert start_res.status_code == 201
    session_log = start_res.json()

    assert session_log["status"] == "in_progress"
    assert session_log["planned_session_id"] == planned_session_id
    assert session_log["workout_plan_id"] == plan["id"]
    assert session_log["session_name"] == mon_session["session_name"]
    assert len(session_log["exercises"]) == len(mon_session["exercises"])

    # Verify first exercise snapshot & pre-populated sets
    first_ex = session_log["exercises"][0]
    assert first_ex["exercise_name"]
    assert first_ex["primary_muscle"]
    assert first_ex["equipment_required"]
    assert len(first_ex["sets"]) >= 3
    assert first_ex["sets"][0]["is_completed"] is False
    assert first_ex["sets"][0]["weight_kg"] is None
    assert first_ex["sets"][0]["reps"] is None


@pytest.mark.asyncio
async def test_prevent_simultaneous_conflicting_active_sessions(client: AsyncClient):
    """Prevent starting a second simultaneous in-progress workout, while resuming the same session idempotently."""
    await client.post("/api/profile", json={"name": "Morgan Workout"})
    await client.put(
        "/api/workouts/profile",
        json={
            "available_days": ["monday", "wednesday", "friday"],
            "available_equipment": ["barbell", "dumbbell", "bench", "bodyweight"],
        },
    )

    plan_res = await client.post("/api/workouts/plans/generate", json={})
    active_sessions = [s for s in plan_res.json()["sessions"] if not s["is_rest_day"]]
    s1_id = active_sessions[0]["id"]
    s2_id = active_sessions[1]["id"]

    # Start session 1
    res1 = await client.post(
        "/api/workouts/sessions/start", json={"planned_session_id": s1_id}
    )
    assert res1.status_code == 201
    log1_id = res1.json()["id"]

    # Starting session 1 again returns the existing in-progress session (idempotent resume)
    res_resume = await client.post(
        "/api/workouts/sessions/start", json={"planned_session_id": s1_id}
    )
    assert res_resume.status_code == 200 or res_resume.status_code == 201
    assert res_resume.json()["id"] == log1_id

    # Attempting to start session 2 returns 409 Conflict
    res_conflict = await client.post(
        "/api/workouts/sessions/start", json={"planned_session_id": s2_id}
    )
    assert res_conflict.status_code == 409
    assert "already in progress" in res_conflict.json()["detail"]


@pytest.mark.asyncio
async def test_save_sets_bodyweight_and_validation(client: AsyncClient):
    """Update sets with weights, reps, completed status, test bodyweight handling and rejection of negatives."""
    await client.post("/api/profile", json={"name": "Sam Workout"})
    await client.put(
        "/api/workouts/profile",
        json={
            "available_days": ["monday", "wednesday"],
            "available_equipment": ["bodyweight", "dumbbell"],
        },
    )

    start_res = await client.post("/api/workouts/sessions/start", json={})
    assert start_res.status_code == 201
    session_id = start_res.json()["id"]

    # 1. Negative weight rejected
    bad_res1 = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={
            "client_version": 1,
            "exercises": [
                {
                    "order_in_session": 1,
                    "sets": [{"set_number": 1, "weight_kg": -10.0, "reps": 10}],
                }
            ]
        },
    )
    assert bad_res1.status_code == 422

    # 2. Negative reps rejected
    bad_res2 = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={
            "client_version": 1,
            "exercises": [
                {
                    "order_in_session": 1,
                    "sets": [{"set_number": 1, "weight_kg": 20.0, "reps": -5}],
                }
            ]
        },
    )
    assert bad_res2.status_code == 422

    # 3. Valid update with bodyweight (None weight) and weighted sets
    valid_update = {
        "client_version": 1,
        "duration_seconds": 1200,
        "notes": "Solid session feeling energetic",
        "exercises": [
            {
                "order_in_session": 1,
                "notes": "Felt good on shoulders",
                "sets": [
                    {
                        "set_number": 1,
                        "weight_kg": None,  # Bodyweight set
                        "reps": 15,
                        "is_completed": True,
                    },
                    {
                        "set_number": 2,
                        "weight_kg": 12.5,
                        "reps": 10,
                        "is_completed": True,
                        "notes": "Smooth tempo",
                    },
                    {
                        "set_number": 3,
                        "weight_kg": 12.5,
                        "reps": 8,
                        "is_completed": False,
                        "is_skipped": True,
                    },
                ],
            }
        ],
    }
    update_res = await client.put(
        f"/api/workouts/sessions/{session_id}", json=valid_update
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["duration_seconds"] == 1200
    assert updated_data["notes"] == "Solid session feeling energetic"

    # Verify set data
    sets = updated_data["exercises"][0]["sets"]
    assert sets[0]["weight_kg"] is None
    assert sets[0]["reps"] == 15
    assert sets[0]["is_completed"] is True
    assert sets[1]["weight_kg"] == 12.5
    assert sets[1]["reps"] == 10
    assert sets[2]["is_skipped"] is True


@pytest.mark.asyncio
async def test_complete_and_cancel_lifecycle(client: AsyncClient):
    """Test transitions to completed and cancelled, and ensure cancelled is not treated as completed."""
    await client.post("/api/profile", json={"name": "Robin Workout"})

    # 1. Start and Complete a session
    start_res = await client.post("/api/workouts/sessions/start", json={"session_name": "Robin Workout 1"})
    s1_id = start_res.json()["id"]

    comp_res = await client.post(f"/api/workouts/sessions/{s1_id}/complete")
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"
    assert comp_res.json()["completed_at"] is not None

    # Cannot cancel an already completed session
    cancel_completed_res = await client.post(f"/api/workouts/sessions/{s1_id}/cancel")
    assert cancel_completed_res.status_code == 400

    # 2. Start and Cancel a second session
    start2_res = await client.post("/api/workouts/sessions/start", json={"session_name": "Robin Workout 2"})
    s2_id = start2_res.json()["id"]

    cancel_res = await client.post(f"/api/workouts/sessions/{s2_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Cannot complete a cancelled session
    comp_cancelled_res = await client.post(f"/api/workouts/sessions/{s2_id}/complete")
    assert comp_cancelled_res.status_code == 400

    # 3. Check history listing
    list_res = await client.get("/api/workouts/sessions")
    assert list_res.status_code == 200
    items = list_res.json()
    statuses = {item["id"]: item["status"] for item in items}
    assert statuses[s1_id] == "completed"
    assert statuses[s2_id] == "cancelled"


@pytest.mark.asyncio
async def test_historical_log_readable_after_plan_regeneration(client: AsyncClient):
    """Historical logs retain snapshot data even when active workout plans are regenerated."""
    await client.post("/api/profile", json={"name": "Casey Workout"})
    await client.put(
        "/api/workouts/profile",
        json={
            "available_days": ["monday", "wednesday", "friday"],
            "available_equipment": ["barbell", "dumbbell", "bodyweight"],
        },
    )

    # 1. Generate plan 1
    p1 = (await client.post("/api/workouts/plans/generate", json={"name": "Plan 1"})).json()
    mon_sess = [s for s in p1["sessions"] if not s["is_rest_day"]][0]

    # 2. Execute and complete workout from Plan 1
    s_res = await client.post(
        "/api/workouts/sessions/start", json={"planned_session_id": mon_sess["id"]}
    )
    log_id = s_res.json()["id"]

    await client.put(
        f"/api/workouts/sessions/{log_id}",
        json={
            "client_version": 1,
            "duration_seconds": 2400,
            "exercises": [
                {
                    "order_in_session": 1,
                    "sets": [{"set_number": 1, "weight_kg": 50.0, "reps": 10, "is_completed": True}],
                }
            ],
        },
    )
    await client.post(f"/api/workouts/sessions/{log_id}/complete")

    # 3. Generate Plan 2 (replaces Plan 1 as active)
    await client.post("/api/workouts/plans/generate", json={"name": "Plan 2"})

    # 4. Fetch the logged session and verify all snapshots remain intact
    get_log_res = await client.get(f"/api/workouts/sessions/{log_id}")
    assert get_log_res.status_code == 200
    log_data = get_log_res.json()

    assert log_data["status"] == "completed"
    assert log_data["duration_seconds"] == 2400
    assert len(log_data["exercises"]) > 0
    first_ex = log_data["exercises"][0]
    assert first_ex["exercise_name"]
    assert first_ex["primary_muscle"]
    assert first_ex["sets"][0]["weight_kg"] == 50.0
    assert first_ex["sets"][0]["reps"] == 10
    assert first_ex["sets"][0]["is_completed"] is True

