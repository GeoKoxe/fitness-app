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
async def test_idempotent_session_completion(client: AsyncClient):
    """Scenario 16: Calling /complete twice on a workout session returns 200 idempotently."""
    # Setup profile
    await client.post("/api/profile", json={"name": "Alex Complete"})

    # Start session
    start_res = await client.post(
        "/api/workouts/sessions/start",
        json={"session_name": "Idempotent Complete Test"},
    )
    assert start_res.status_code == 201
    session_id = start_res.json()["id"]

    # First complete call
    comp1 = await client.post(f"/api/workouts/sessions/{session_id}/complete")
    assert comp1.status_code == 200
    comp1_data = comp1.json()
    assert comp1_data["status"] == "completed"
    assert comp1_data["completed_at"] is not None

    # Second complete call must succeed idempotently without error
    comp2 = await client.post(f"/api/workouts/sessions/{session_id}/complete")
    assert comp2.status_code == 200
    comp2_data = comp2.json()
    assert comp2_data["status"] == "completed"
    assert comp2_data["id"] == session_id
    assert comp2_data["completed_at"] == comp1_data["completed_at"]


@pytest.mark.asyncio
async def test_idempotent_session_cancellation(client: AsyncClient):
    """Scenario 17: Calling /cancel twice on a workout session returns 200 idempotently."""
    await client.post("/api/profile", json={"name": "Alex Cancel"})

    # Start session
    start_res = await client.post(
        "/api/workouts/sessions/start",
        json={"session_name": "Idempotent Cancel Test"},
    )
    assert start_res.status_code == 201
    session_id = start_res.json()["id"]

    # First cancel call
    cancel1 = await client.post(f"/api/workouts/sessions/{session_id}/cancel")
    assert cancel1.status_code == 200
    cancel1_data = cancel1.json()
    assert cancel1_data["status"] == "cancelled"
    assert cancel1_data["completed_at"] is not None

    # Second cancel call must succeed idempotently without changing timestamps or erroring
    cancel2 = await client.post(f"/api/workouts/sessions/{session_id}/cancel")
    assert cancel2.status_code == 200
    cancel2_data = cancel2.json()
    assert cancel2_data["status"] == "cancelled"
    assert cancel2_data["id"] == session_id
    assert cancel2_data["completed_at"] == cancel1_data["completed_at"]


@pytest.mark.asyncio
async def test_update_rejected_on_terminal_sessions(client: AsyncClient):
    """Scenario 18: Updates are strictly rejected (400 Bad Request) on completed or cancelled sessions."""
    await client.post("/api/profile", json={"name": "Alex Reject Updates"})

    # 1. Test completed session
    start1 = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Completed Session"}
    )
    s1_id = start1.json()["id"]
    await client.post(f"/api/workouts/sessions/{s1_id}/complete")

    update_res1 = await client.put(
        f"/api/workouts/sessions/{s1_id}",
        json={"notes": "Attempting update on completed session"},
    )
    assert update_res1.status_code == 400
    assert "Cannot update a workout session with status 'completed'" in update_res1.json()["detail"]

    # 2. Test cancelled session
    start2 = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Cancelled Session"}
    )
    s2_id = start2.json()["id"]
    await client.post(f"/api/workouts/sessions/{s2_id}/cancel")

    update_res2 = await client.put(
        f"/api/workouts/sessions/{s2_id}",
        json={"notes": "Attempting update on cancelled session"},
    )
    assert update_res2.status_code == 400
    assert "Cannot update a workout session with status 'cancelled'" in update_res2.json()["detail"]


@pytest.mark.asyncio
async def test_active_session_resumption_and_status(client: AsyncClient):
    """Verify active session retrieval matches currently in-progress workout, or None when completed."""
    await client.post("/api/profile", json={"name": "Alex Active Fetch"})

    # Initially None
    res0 = await client.get("/api/workouts/sessions/active")
    assert res0.status_code == 200
    assert res0.json() is None

    # Start session
    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Active Test Session"}
    )
    session_id = start_res.json()["id"]

    # Active endpoint returns this session
    res1 = await client.get("/api/workouts/sessions/active")
    assert res1.status_code == 200
    assert res1.json() is not None
    assert res1.json()["id"] == session_id
    assert res1.json()["status"] == "in_progress"

    # Complete session -> active returns None
    await client.post(f"/api/workouts/sessions/{session_id}/complete")
    res2 = await client.get("/api/workouts/sessions/active")
    assert res2.status_code == 200
    assert res2.json() is None

