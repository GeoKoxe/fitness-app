from datetime import datetime, timedelta
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


@pytest.mark.asyncio
async def test_multi_tab_optimistic_conflict_detection(client: AsyncClient):
    """Verify multi-tab conflict detection via version returns 409 Conflict."""
    await client.post("/api/profile", json={"name": "Alex MultiTab"})

    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "MultiTab Session"}
    )
    session_id = start_res.json()["id"]

    # Tab B performs an update (version advances to 2)
    tab_b_res = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"notes": "Update from Tab B", "client_version": 1},
    )
    assert tab_b_res.status_code == 200
    assert tab_b_res.json()["version"] == 2

    # Tab A attempts update with stale version 1
    tab_a_conflict = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={
            "notes": "Stale update from Tab A",
            "client_version": 1,
        },
    )
    assert tab_a_conflict.status_code == 409
    assert "modified in another window or tab" in tab_a_conflict.json()["detail"]

    # Tab A updating with matching/current version 2 succeeds
    tab_a_success = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={
            "notes": "Resolved update from Tab A",
            "client_version": 2,
        },
    )
    assert tab_a_success.status_code == 200
    assert tab_a_success.json()["notes"] == "Resolved update from Tab A"
    assert tab_a_success.json()["version"] == 3


@pytest.mark.asyncio
async def test_cancelling_session_persists_final_duration(client: AsyncClient):
    """Verify final duration is persisted when cancelling an in-progress workout."""
    await client.post("/api/profile", json={"name": "Alex Cancel Duration"})

    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Cancel Duration Test"}
    )
    session_id = start_res.json()["id"]

    # Update final duration with client_version=1 (version advances to 2)
    update_res = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"duration_seconds": 1450, "notes": "Felt tired after 24m", "client_version": 1},
    )
    assert update_res.status_code == 200
    assert update_res.json()["version"] == 2

    # Cancel session with client_version=2
    cancel_res = await client.post(
        f"/api/workouts/sessions/{session_id}/cancel",
        json={"client_version": 2},
    )
    assert cancel_res.status_code == 200

    # Fetch historical log
    get_res = await client.get(f"/api/workouts/sessions/{session_id}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["status"] == "cancelled"
    assert data["duration_seconds"] == 1450
    assert data["notes"] == "Felt tired after 24m"
    assert data["version"] == 3


@pytest.mark.asyncio
async def test_concurrency_two_updates_same_version_conflict(client: AsyncClient):
    """Scenario 1: Two updates sharing same initial version — first succeeds (becomes 2), second gets 409."""
    await client.post("/api/profile", json={"name": "OCC Test 1"})

    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "OCC Race 1"}
    )
    assert start_res.status_code == 201
    s_data = start_res.json()
    session_id = s_data["id"]
    initial_ver = s_data.get("version", 1)
    assert initial_ver == 1

    # Tab A sends update with client_version=1
    tab_a = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"notes": "Tab A update", "client_version": 1},
    )
    assert tab_a.status_code == 200
    assert tab_a.json()["version"] == 2
    assert tab_a.json()["notes"] == "Tab A update"

    # Tab B sends update with stale client_version=1
    tab_b = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"notes": "Tab B stale update", "client_version": 1},
    )
    assert tab_b.status_code == 409
    assert "Workout session conflict: expected version 1, but server is at version 2" in tab_b.json()["detail"]


@pytest.mark.asyncio
async def test_concurrency_same_second_conflict_prevented_by_version(client: AsyncClient):
    """Scenario 2: Concurrent updates in exact same second still conflict because integer version differs."""
    await client.post("/api/profile", json={"name": "OCC Test 2"})

    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "OCC Same Second"}
    )
    session_id = start_res.json()["id"]

    # First update succeeds
    res1 = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"duration_seconds": 10, "client_version": 1},
    )
    assert res1.status_code == 200
    assert res1.json()["version"] == 2

    # Second update sends version 1 immediately (even if wall-clock timestamps match)
    res2 = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"duration_seconds": 20, "client_version": 1},
    )
    assert res2.status_code == 409


@pytest.mark.asyncio
async def test_concurrency_stale_update_modifies_zero_fields(client: AsyncClient):
    """Scenario 3: Stale update rejected with 409 modifies 0 session fields in the DB."""
    await client.post("/api/profile", json={"name": "OCC Test 3"})

    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Original Name"}
    )
    session_id = start_res.json()["id"]

    # Tab A advances version to 2
    res_a = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"session_name": "Tab A Name", "notes": "Tab A Notes", "client_version": 1},
    )
    assert res_a.status_code == 200
    assert res_a.json()["version"] == 2

    # Tab B attempts stale update to overwrite name, notes, and duration
    res_b = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={
            "session_name": "Overwritten Name",
            "notes": "Overwritten Notes",
            "duration_seconds": 9999,
            "client_version": 1,
        },
    )
    assert res_b.status_code == 409

    # Verify database was untouched by Tab B
    fresh = await client.get(f"/api/workouts/sessions/{session_id}")
    assert fresh.status_code == 200
    fresh_data = fresh.json()
    assert fresh_data["session_name"] == "Tab A Name"
    assert fresh_data["notes"] == "Tab A Notes"
    assert fresh_data["duration_seconds"] == 0
    assert fresh_data["version"] == 2


@pytest.mark.asyncio
async def test_concurrency_force_overwrite_advances_version(client: AsyncClient):
    """Scenario 4 & 5: Force overwrite succeeds and advances version; subsequent stale updates are rejected."""
    await client.post("/api/profile", json={"name": "OCC Test 4"})

    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Force Overwrite Test"}
    )
    session_id = start_res.json()["id"]

    # Tab A advances to version 2
    await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"notes": "Tab A notes", "client_version": 1},
    )

    # Tab B forces overwrite with force_overwrite=True
    force_res = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"notes": "Forced Notes from Tab B", "force_overwrite": True},
    )
    assert force_res.status_code == 200
    assert force_res.json()["notes"] == "Forced Notes from Tab B"
    assert force_res.json()["version"] == 3

    # Subsequent update with stale version 2 must be rejected
    stale_res = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"notes": "Stale update with v2", "client_version": 2},
    )
    assert stale_res.status_code == 409
    assert "expected version 2, but server is at version 3" in stale_res.json()["detail"]


@pytest.mark.asyncio
async def test_concurrency_lifecycle_advances_version(client: AsyncClient):
    """Scenario 9 & 10: Session completion and cancellation advance the version counter."""
    await client.post("/api/profile", json={"name": "OCC Test Lifecycle"})

    # Session 1: complete advances version
    s1 = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Complete Version Test"}
    )
    s1_id = s1.json()["id"]
    assert s1.json()["version"] == 1

    comp = await client.post(f"/api/workouts/sessions/{s1_id}/complete")
    assert comp.status_code == 200
    assert comp.json()["version"] == 2

    # Session 2: cancel advances version
    s2 = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Cancel Version Test"}
    )
    s2_id = s2.json()["id"]
    assert s2.json()["version"] == 1

    canc = await client.post(f"/api/workouts/sessions/{s2_id}/cancel")
    assert canc.status_code == 200
    assert canc.json()["version"] == 2


@pytest.mark.asyncio
async def test_update_missing_version_rejected_with_400(client: AsyncClient):
    """Batch 3.3: Normal updates without client_version are rejected with 400 Bad Request."""
    await client.post("/api/profile", json={"name": "Missing Version User"})

    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Missing Version Test"}
    )
    session_id = start_res.json()["id"]

    res = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"notes": "Update missing version"},
    )
    assert res.status_code == 400
    assert "client_version is required" in res.json()["detail"]


@pytest.mark.asyncio
async def test_update_missing_version_allowed_with_force_overwrite(client: AsyncClient):
    """Batch 3.3: Force overwrite bypasses client_version requirement, advances version safely."""
    await client.post("/api/profile", json={"name": "Force Overwrite User"})

    start_res = await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Force Overwrite Missing Ver"}
    )
    session_id = start_res.json()["id"]

    res = await client.put(
        f"/api/workouts/sessions/{session_id}",
        json={"notes": "Forced note without version", "force_overwrite": True},
    )
    assert res.status_code == 200
    assert res.json()["notes"] == "Forced note without version"
    assert res.json()["version"] == 2


@pytest.mark.asyncio
async def test_stale_completion_and_cancellation_rejected(client: AsyncClient):
    """Batch 3.3: Stale completion and cancellation calls with mismatched version return 409."""
    await client.post("/api/profile", json={"name": "Stale Complete User"})

    # Session 1: Stale complete
    s1 = (await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Stale Complete 1"}
    )).json()
    s1_id = s1["id"]

    # Tab B advances version to 2
    await client.put(
        f"/api/workouts/sessions/{s1_id}",
        json={"notes": "Tab B advanced version", "client_version": 1},
    )

    # Tab A tries to complete with stale client_version 1
    bad_comp = await client.post(
        f"/api/workouts/sessions/{s1_id}/complete",
        json={"client_version": 1},
    )
    assert bad_comp.status_code == 409
    assert "expected version 1, but server is at version 2" in bad_comp.json()["detail"]

    # Session remains in_progress
    fresh1 = (await client.get(f"/api/workouts/sessions/{s1_id}")).json()
    assert fresh1["status"] == "in_progress"

    # Tab A force completes
    forced_comp = await client.post(
        f"/api/workouts/sessions/{s1_id}/complete",
        json={"force_overwrite": True},
    )
    assert forced_comp.status_code == 200
    assert forced_comp.json()["status"] == "completed"
    assert forced_comp.json()["version"] == 3

    # Session 2: Stale cancel
    s2 = (await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Stale Cancel 2"}
    )).json()
    s2_id = s2["id"]

    # Tab B advances version to 2
    await client.put(
        f"/api/workouts/sessions/{s2_id}",
        json={"notes": "Tab B advanced version", "client_version": 1},
    )

    # Tab A tries to cancel with stale client_version 1
    bad_canc = await client.post(
        f"/api/workouts/sessions/{s2_id}/cancel",
        json={"client_version": 1},
    )
    assert bad_canc.status_code == 409
    assert "expected version 1, but server is at version 2" in bad_canc.json()["detail"]

    fresh2 = (await client.get(f"/api/workouts/sessions/{s2_id}")).json()
    assert fresh2["status"] == "in_progress"


@pytest.mark.asyncio
async def test_terminal_session_protection_even_with_force_overwrite(client: AsyncClient):
    """Batch 3.3: Completed or cancelled sessions cannot be modified even with force_overwrite."""
    await client.post("/api/profile", json={"name": "Terminal Protected User"})

    # Complete a session
    s = (await client.post(
        "/api/workouts/sessions/start", json={"session_name": "Terminal Sess"}
    )).json()
    sid = s["id"]
    await client.post(f"/api/workouts/sessions/{sid}/complete")

    # Attempt force overwrite on completed session
    res = await client.put(
        f"/api/workouts/sessions/{sid}",
        json={"notes": "Illegal write to completed session", "force_overwrite": True},
    )
    assert res.status_code == 400
    assert "Cannot update a workout session with status 'completed'" in res.json()["detail"]


def test_simultaneous_concurrent_threads_atomic_conflict(tmp_path):
    """Batch 3.3: Genuinely concurrent threads executing update_session simultaneously with identical version: exactly one succeeds and second gets 409."""
    from concurrent.futures import ThreadPoolExecutor
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models.base import Base
    from app.models.profile import UserProfile
    from app.models.workout_log import WorkoutSessionLog, LoggedExercise, LoggedExerciseSet
    from app.schemas.workout_log import WorkoutSessionLogUpdate, LoggedExerciseUpdate, LoggedExerciseSetUpdate
    from app.services.workout_execution_service import workout_execution_service
    from fastapi import HTTPException

    db_file = tmp_path / "test_concurrent.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"timeout": 10.0})
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)

    init_db = SessionLocal()
    profile = UserProfile(name="Concurrent Thread User")
    init_db.add(profile)
    init_db.commit()
    init_db.refresh(profile)

    sess = WorkoutSessionLog(
        user_profile_id=profile.id,
        session_name="Concurrent Workout",
        status="in_progress",
        version=1,
    )
    init_db.add(sess)
    init_db.commit()
    init_db.refresh(sess)

    ex = LoggedExercise(
        session_log_id=sess.id,
        order_in_session=1,
        exercise_slug="bench_press",
        exercise_name="Bench Press",
        primary_muscle="chest",
        equipment_required="barbell",
        movement_category="push",
    )
    init_db.add(ex)
    init_db.commit()
    init_db.refresh(ex)

    s1 = LoggedExerciseSet(
        logged_exercise_id=ex.id,
        set_number=1,
        weight_kg=50.0,
        reps=10,
        is_completed=False,
    )
    init_db.add(s1)
    init_db.commit()
    session_id = sess.id
    ex_id = ex.id
    init_db.close()

    def worker(worker_id: int):
        worker_db = SessionLocal()
        try:
            update_in = WorkoutSessionLogUpdate(
                session_name=f"Update from Worker {worker_id}",
                duration_seconds=100 * worker_id,
                client_version=1,
                exercises=[
                    LoggedExerciseUpdate(
                        id=ex_id,
                        order_in_session=1,
                        sets=[
                            LoggedExerciseSetUpdate(
                                set_number=1,
                                weight_kg=60.0 + worker_id * 10,
                                reps=8 + worker_id,
                                is_completed=True,
                            )
                        ],
                    )
                ],
            )
            res = workout_execution_service.update_session(worker_db, session_id, update_in)
            return {"worker": worker_id, "status": 200, "version": res.version}
        except HTTPException as e:
            return {"worker": worker_id, "status": e.status_code, "detail": e.detail}
        finally:
            worker_db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        fut1 = executor.submit(worker, 1)
        fut2 = executor.submit(worker, 2)
        r1 = fut1.result()
        r2 = fut2.result()

    statuses = sorted([r1["status"], r2["status"]])
    assert statuses == [200, 409], f"Expected exactly [200, 409], got {statuses}"

    verify_db = SessionLocal()
    final_sess = verify_db.get(WorkoutSessionLog, session_id)
    assert final_sess is not None
    assert final_sess.version == 2
    final_set = verify_db.query(LoggedExerciseSet).filter_by(set_number=1).first()
    assert final_set is not None
    winning_worker = 1 if r1["status"] == 200 else 2
    assert final_set.weight_kg == 60.0 + winning_worker * 10
    verify_db.close()
