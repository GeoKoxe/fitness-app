import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_duration_validation_15min_increments(client: AsyncClient):
    """Test that preferred_duration_minutes strictly validates 15-minute intervals between 15 and 180."""
    await client.post("/api/profile", json={"name": "Alex Duration"})

    # Valid durations: 15, 30, 45, 60, 75, 90, 120, 180
    for valid_dur in [15, 30, 45, 60, 75, 90, 120, 180]:
        res = await client.put(
            "/api/workouts/profile",
            json={"preferred_duration_minutes": valid_dur},
        )
        assert res.status_code == 200
        assert res.json()["preferred_duration_minutes"] == valid_dur

    # Invalid durations: non-multiples of 15 (e.g., 20, 35, 50, 70), below 15 (e.g. 10, 0), above 180 (e.g. 195)
    for invalid_dur in [0, 10, 20, 35, 50, 70, 100, 195]:
        res = await client.put(
            "/api/workouts/profile",
            json={"preferred_duration_minutes": invalid_dur},
        )
        assert res.status_code == 422


@pytest.mark.asyncio
async def test_saved_training_profiles_crud_and_apply(client: AsyncClient):
    """Test creating, listing, updating, renaming, deleting, and applying saved training profile configurations."""
    # Create user profile
    await client.post("/api/profile", json={"name": "Sam Config"})

    # 1. Initially empty
    list_res = await client.get("/api/workouts/profile/saved")
    assert list_res.status_code == 200
    assert list_res.json() == []

    # 2. Create a saved profile configuration
    config1_payload = {
        "name": "Home Bodyweight Routine",
        "description": "30-minute bodyweight routine for travel or home",
        "experience_level": "intermediate",
        "training_goals": ["endurance", "general_fitness"],
        "available_days": ["tuesday", "thursday", "saturday"],
        "preferred_duration_minutes": 30,
        "available_equipment": ["bodyweight"],
        "excluded_exercises": ["burpee"],
        "excluded_muscle_groups": ["calves"],
        "training_considerations": "Keep rest brief",
    }
    create_res = await client.post("/api/workouts/profile/saved", json=config1_payload)
    assert create_res.status_code == 201
    config1 = create_res.json()
    assert config1["name"] == "Home Bodyweight Routine"
    assert config1["preferred_duration_minutes"] == 30
    assert config1["available_days"] == ["tuesday", "thursday", "saturday"]
    config1_id = config1["id"]

    # 3. Duplicate name returns 409
    dup_res = await client.post("/api/workouts/profile/saved", json=config1_payload)
    assert dup_res.status_code == 409

    # 4. Create second configuration
    config2_payload = {
        "name": "Gym Heavy Strength",
        "experience_level": "advanced",
        "training_goals": ["strength"],
        "available_days": ["monday", "wednesday", "friday", "sunday"],
        "preferred_duration_minutes": 75,
        "available_equipment": ["barbell", "dumbbell", "bench", "cable"],
    }
    create2_res = await client.post("/api/workouts/profile/saved", json=config2_payload)
    assert create2_res.status_code == 201
    config2_id = create2_res.json()["id"]

    # 5. List saved configurations
    list_res2 = await client.get("/api/workouts/profile/saved")
    assert list_res2.status_code == 200
    names = [c["name"] for c in list_res2.json()]
    assert "Home Bodyweight Routine" in names
    assert "Gym Heavy Strength" in names

    # 6. Get single saved config
    get_res = await client.get(f"/api/workouts/profile/saved/{config1_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Home Bodyweight Routine"

    # 7. Update/Rename configuration
    update_res = await client.put(
        f"/api/workouts/profile/saved/{config1_id}",
        json={"name": "Home Calisthenics Routine", "preferred_duration_minutes": 45},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Home Calisthenics Routine"
    assert update_res.json()["preferred_duration_minutes"] == 45

    # 8. Apply saved configuration to active training profile
    apply_res = await client.post(f"/api/workouts/profile/saved/{config1_id}/apply")
    assert apply_res.status_code == 200
    active_profile = apply_res.json()
    assert active_profile["preferred_duration_minutes"] == 45
    assert active_profile["available_days"] == ["tuesday", "thursday", "saturday"]
    assert active_profile["experience_level"] == "intermediate"

    # Verify active profile GET matches
    get_profile_res = await client.get("/api/workouts/profile")
    assert get_profile_res.status_code == 200
    assert get_profile_res.json()["preferred_duration_minutes"] == 45
    assert get_profile_res.json()["available_days"] == ["tuesday", "thursday", "saturday"]

    # 9. Delete saved configuration
    del_res = await client.delete(f"/api/workouts/profile/saved/{config2_id}")
    assert del_res.status_code == 204

    # Verify deletion
    get_del_res = await client.get(f"/api/workouts/profile/saved/{config2_id}")
    assert get_del_res.status_code == 404

