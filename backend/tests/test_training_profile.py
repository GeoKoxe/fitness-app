import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_training_profile_when_no_user_profile(client: AsyncClient):
    """When no user profile exists, GET returns defaults with user_profile_id=None."""
    res = await client.get("/api/workouts/profile")
    assert res.status_code == 200
    data = res.json()
    assert data["user_profile_id"] is None
    assert data["experience_level"] == "beginner"
    assert "general_fitness" in data["training_goals"]
    assert "monday" in data["available_days"]
    assert data["preferred_duration_minutes"] == 60


@pytest.mark.asyncio
async def test_put_training_profile_without_user_profile_fails(client: AsyncClient):
    """Attempting to save training profile before creating a user profile returns 400."""
    res = await client.put(
        "/api/workouts/profile",
        json={"experience_level": "intermediate"},
    )
    assert res.status_code == 400
    assert "User profile not found" in res.json()["detail"]


@pytest.mark.asyncio
async def test_get_and_put_training_profile_workflow(client: AsyncClient):
    """Full lifecycle: create user profile, get default training profile, create and update."""
    # 1. Create user profile
    user_res = await client.post(
        "/api/profile",
        json={"name": "Alex", "activity_level": "moderately_active"},
    )
    assert user_res.status_code == 201
    user_id = user_res.json()["id"]

    # 2. GET profile returns defaults with user_profile_id linked
    res1 = await client.get("/api/workouts/profile")
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["user_profile_id"] == user_id
    assert d1["id"] is None
    assert d1["experience_level"] == "beginner"

    # 3. PUT create training profile
    payload = {
        "experience_level": "intermediate",
        "training_goals": ["hypertrophy", "strength"],
        "available_days": ["monday", "tuesday", "thursday", "friday"],
        "preferred_duration_minutes": 45,
        "available_equipment": ["barbell", "dumbbell", "bench"],
        "excluded_exercises": ["barbell_bench_press"],
        "excluded_muscle_groups": ["lower_back"],
        "training_considerations": "Previous lower back sprain, avoid heavy axial loading.",
    }
    res2 = await client.put("/api/workouts/profile", json=payload)
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["id"] is not None
    assert d2["user_profile_id"] == user_id
    assert d2["experience_level"] == "intermediate"
    assert d2["training_goals"] == ["hypertrophy", "strength"]
    assert d2["available_days"] == ["monday", "tuesday", "thursday", "friday"]
    assert d2["preferred_duration_minutes"] == 45
    assert set(d2["available_equipment"]) == {"barbell", "dumbbell", "bench"}
    assert d2["excluded_exercises"] == ["barbell_bench_press"]
    assert d2["excluded_muscle_groups"] == ["lower_back"]
    assert d2["training_considerations"] == "Previous lower back sprain, avoid heavy axial loading."

    profile_db_id = d2["id"]

    # 4. GET verifies persisted profile
    res3 = await client.get("/api/workouts/profile")
    assert res3.status_code == 200
    d3 = res3.json()
    assert d3["id"] == profile_db_id
    assert d3["experience_level"] == "intermediate"
    assert d3["training_goals"] == ["hypertrophy", "strength"]

    # 5. Subsequent PUT updates the existing record without duplicate
    update_payload = {
        "experience_level": "advanced",
        "preferred_duration_minutes": 75,
        "training_goals": ["strength"],
    }
    res4 = await client.put("/api/workouts/profile", json=update_payload)
    assert res4.status_code == 200
    d4 = res4.json()
    assert d4["id"] == profile_db_id  # Same record ID, no duplicates!
    assert d4["experience_level"] == "advanced"
    assert d4["preferred_duration_minutes"] == 75
    assert d4["training_goals"] == ["strength"]
    # Existing equipment and considerations preserved
    assert set(d4["available_equipment"]) == {"barbell", "dumbbell", "bench"}
    assert d4["training_considerations"] == "Previous lower back sprain, avoid heavy axial loading."


@pytest.mark.asyncio
async def test_training_profile_validations(client: AsyncClient):
    """Validation checks for experience level, duration, days, and goals."""
    # Create user profile first
    await client.post("/api/profile", json={"name": "Sam"})

    # Invalid experience level
    res = await client.put(
        "/api/workouts/profile", json={"experience_level": "superman"}
    )
    assert res.status_code == 422

    # Invalid duration (<15 or >180)
    res = await client.put(
        "/api/workouts/profile", json={"preferred_duration_minutes": 10}
    )
    assert res.status_code == 422
    res = await client.put(
        "/api/workouts/profile", json={"preferred_duration_minutes": 200}
    )
    assert res.status_code == 422

    # Empty goals list
    res = await client.put("/api/workouts/profile", json={"training_goals": []})
    assert res.status_code == 422

    # Invalid goal token
    res = await client.put(
        "/api/workouts/profile", json={"training_goals": ["fly_in_space"]}
    )
    assert res.status_code == 422

    # Empty weekdays list
    res = await client.put("/api/workouts/profile", json={"available_days": []})
    assert res.status_code == 422

    # Invalid weekday
    res = await client.put(
        "/api/workouts/profile", json={"available_days": ["funday"]}
    )
    assert res.status_code == 422
