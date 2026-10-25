import pytest
from httpx import AsyncClient

from app.db.seed_exercises import seed_built_in_exercises
from app.models.exercise import Exercise
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def seed_exercises_db():
    db = TestSessionLocal()
    try:
        seed_built_in_exercises(db)
    finally:
        db.close()


@pytest.mark.asyncio
async def test_seed_built_in_exercises_idempotent():
    """Verify that seeding built-in exercises is strictly idempotent and does not create duplicates."""
    db = TestSessionLocal()
    try:
        initial_count = db.query(Exercise).filter(Exercise.is_built_in.is_(True)).count()
        assert initial_count >= 50, f"Expected at least 50 built-in exercises, got {initial_count}"

        # Re-running seeder should insert 0 new records
        reseed_count = seed_built_in_exercises(db)
        assert reseed_count == 0, f"Expected 0 reseeded items, got {reseed_count}"

        final_count = db.query(Exercise).filter(Exercise.is_built_in.is_(True)).count()
        assert final_count == initial_count
    finally:
        db.close()


@pytest.mark.asyncio
async def test_list_exercises_and_pagination(client: AsyncClient):
    """Verify listing exercises with default and custom pagination limits."""
    res = await client.get("/api/exercises?skip=0&limit=20")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 20
    assert all("id" in item and "slug" in item and "name" in item for item in items)


@pytest.mark.asyncio
async def test_search_exercises_by_query(client: AsyncClient):
    """Verify text search across exercise names and instructions."""
    # Search by name
    res = await client.get("/api/exercises?q=Bench")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 2
    assert any("bench press" in item["name"].lower() for item in items)

    # Search by keyword in instructions (e.g. "trapezius")
    res_inst = await client.get("/api/exercises?q=trapezius")
    assert res_inst.status_code == 200
    items_inst = res_inst.json()
    assert len(items_inst) >= 1
    assert any("squat" in item["slug"] for item in items_inst)


@pytest.mark.asyncio
async def test_filter_exercises_by_primary_muscle(client: AsyncClient):
    """Verify filtering exercises by primary target muscle group."""
    res_chest = await client.get("/api/exercises?primary_muscle=chest")
    assert res_chest.status_code == 200
    chest_items = res_chest.json()
    assert len(chest_items) >= 5
    assert all(item["primary_muscle"] == "chest" for item in chest_items)

    res_quads = await client.get("/api/exercises?primary_muscle=quadriceps")
    assert res_quads.status_code == 200
    quad_items = res_quads.json()
    assert len(quad_items) >= 5
    assert all(item["primary_muscle"] == "quadriceps" for item in quad_items)


@pytest.mark.asyncio
async def test_filter_exercises_by_equipment(client: AsyncClient):
    """Verify filtering exercises by required equipment."""
    res_bw = await client.get("/api/exercises?equipment=bodyweight")
    assert res_bw.status_code == 200
    bw_items = res_bw.json()
    assert len(bw_items) >= 5
    assert all(item["equipment_required"] == "bodyweight" for item in bw_items)
    slugs = {item["slug"] for item in bw_items}
    assert "push_up" in slugs
    assert "plank" in slugs

    res_bb = await client.get("/api/exercises?equipment=barbell")
    assert res_bb.status_code == 200
    bb_items = res_bb.json()
    assert len(bb_items) >= 8
    assert all(item["equipment_required"] == "barbell" for item in bb_items)


@pytest.mark.asyncio
async def test_filter_exercises_by_movement_category(client: AsyncClient):
    """Verify filtering exercises by movement category."""
    res_hinge = await client.get("/api/exercises?movement_category=hinge")
    assert res_hinge.status_code == 200
    hinge_items = res_hinge.json()
    assert len(hinge_items) >= 5
    assert all(item["movement_category"] == "hinge" for item in hinge_items)
    slugs = {item["slug"] for item in hinge_items}
    assert "barbell_deadlift" in slugs
    assert "romanian_deadlift" in slugs

    res_pull = await client.get("/api/exercises?movement_category=vertical_pull")
    assert res_pull.status_code == 200
    pull_items = res_pull.json()
    assert len(pull_items) >= 3
    assert all(item["movement_category"] == "vertical_pull" for item in pull_items)


@pytest.mark.asyncio
async def test_filter_exercises_by_difficulty(client: AsyncClient):
    """Verify filtering exercises by difficulty level."""
    res_adv = await client.get("/api/exercises?difficulty=advanced")
    assert res_adv.status_code == 200
    adv_items = res_adv.json()
    assert len(adv_items) >= 3
    assert all(item["difficulty_level"] == "advanced" for item in adv_items)
    slugs = {item["slug"] for item in adv_items}
    assert "barbell_deadlift" in slugs or "hanging_leg_raise" in slugs or "chest_dips" in slugs


@pytest.mark.asyncio
async def test_get_exercise_by_id_and_not_found(client: AsyncClient):
    """Verify fetching single exercise by ID or handling 404 for unknown IDs."""
    list_res = await client.get("/api/exercises?limit=1")
    first = list_res.json()[0]
    ex_id = first["id"]

    res = await client.get(f"/api/exercises/{ex_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == ex_id
    assert data["slug"] == first["slug"]
    assert len(data["instructions"]) > 0

    res_404 = await client.get("/api/exercises/999999")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_custom_exercise_and_slug_generation(client: AsyncClient):
    """Verify creating a user custom exercise with automatic unique slug generation."""
    # Create profile
    await client.post(
        "/api/profile",
        json={
            "name": "Workout Enthusiast",
            "date_of_birth": "1994-06-15",
            "gender": "male",
            "height_cm": 180.0,
            "activity_level": "very_active",
        },
    )

    create_payload = {
        "name": "Banded Lateral Monster Walk",
        "movement_category": "isolation",
        "primary_muscle": "glutes",
        "secondary_muscles": "abductors",
        "equipment_required": "resistance_band",
        "difficulty_level": "beginner",
        "instructions": "Place band above knees and take controlled lateral steps maintaining tension.",
        "alternative_exercise_slugs": "dumbbell_glute_bridge",
    }

    res = await client.post("/api/exercises", json=create_payload)
    assert res.status_code == 201
    created = res.json()
    assert created["id"] > 0
    assert created["slug"] == "banded_lateral_monster_walk"
    assert created["name"] == "Banded Lateral Monster Walk"
    assert created["is_built_in"] is False
    assert created["user_profile_id"] is not None


@pytest.mark.asyncio
async def test_built_in_exercise_protection(client: AsyncClient):
    """Verify that built-in exercises cannot be modified or deleted."""
    # Create profile
    await client.post(
        "/api/profile",
        json={
            "name": "Admin Tester",
            "date_of_birth": "1990-01-01",
            "gender": "female",
            "height_cm": 165.0,
            "activity_level": "moderately_active",
        },
    )

    list_res = await client.get("/api/exercises?limit=5")
    built_in = next(item for item in list_res.json() if item["is_built_in"] is True)
    built_in_id = built_in["id"]

    # Attempt PUT
    put_res = await client.put(
        f"/api/exercises/{built_in_id}",
        json={"name": "Hacked Name"},
    )
    assert put_res.status_code == 403
    assert "built-in exercises are read-only" in put_res.json()["detail"].lower()

    # Attempt DELETE
    del_res = await client.delete(f"/api/exercises/{built_in_id}")
    assert del_res.status_code == 403
    assert "built-in exercises are protected" in del_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_and_delete_custom_exercise(client: AsyncClient):
    """Verify updating and deleting a user's custom exercise."""
    # Create profile
    await client.post(
        "/api/profile",
        json={
            "name": "Custom Editor",
            "date_of_birth": "1992-11-20",
            "gender": "male",
            "height_cm": 175.0,
            "activity_level": "very_active",
        },
    )

    # Create custom
    create_res = await client.post(
        "/api/exercises",
        json={
            "name": "Temporary Custom Exercise",
            "movement_category": "core",
            "primary_muscle": "abdominals",
            "equipment_required": "bodyweight",
            "difficulty_level": "beginner",
            "instructions": "Simple test movement.",
        },
    )
    assert create_res.status_code == 201
    custom_id = create_res.json()["id"]

    # Update
    update_res = await client.put(
        f"/api/exercises/{custom_id}",
        json={"name": "Updated Custom Exercise Name", "difficulty_level": "intermediate"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Custom Exercise Name"
    assert update_res.json()["difficulty_level"] == "intermediate"

    # Delete
    del_res = await client.delete(f"/api/exercises/{custom_id}")
    assert del_res.status_code == 204

    # Verify 404 after delete
    get_res = await client.get(f"/api/exercises/{custom_id}")
    assert get_res.status_code == 404

