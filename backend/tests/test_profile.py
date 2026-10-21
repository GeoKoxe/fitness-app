import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_profile_empty(client: AsyncClient):
    response = await client.get("/api/profile")
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_create_and_get_profile(client: AsyncClient):
    payload = {
        "name": "Nikos Papadopoulos",
        "date_of_birth": "1990-05-15",
        "sex": "male",
        "height_cm": 178.5,
        "activity_level": "moderately_active",
    }
    create_res = await client.post("/api/profile", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["name"] == "Nikos Papadopoulos"
    assert data["height_cm"] == 178.5
    assert data["sex"] == "male"
    assert data["activity_level"] == "moderately_active"
    assert data["id"] is not None
    assert "created_at" in data

    # Retrieve profile
    get_res = await client.get("/api/profile")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Nikos Papadopoulos"


@pytest.mark.asyncio
async def test_create_duplicate_profile_conflict(client: AsyncClient):
    payload = {"name": "User 1"}
    res1 = await client.post("/api/profile", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/profile", json={"name": "User 2"})
    assert res2.status_code == 409


@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient):
    await client.post(
        "/api/profile",
        json={"name": "Alex", "height_cm": 170.0, "sex": "other"},
    )

    update_res = await client.patch(
        "/api/profile",
        json={"height_cm": 172.5, "activity_level": "very_active"},
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Alex"
    assert updated["height_cm"] == 172.5
    assert updated["activity_level"] == "very_active"


@pytest.mark.asyncio
async def test_profile_validation_future_dob(client: AsyncClient):
    res = await client.post(
        "/api/profile",
        json={"name": "Time Traveler", "date_of_birth": "2099-01-01"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_profile_validation_invalid_height(client: AsyncClient):
    res = await client.post(
        "/api/profile",
        json={"name": "Test", "height_cm": 10.0},  # Under 50 cm
    )
    assert res.status_code == 422

