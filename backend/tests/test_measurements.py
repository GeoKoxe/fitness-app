from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_measurement_without_profile_fails(client: AsyncClient):
    payload = {"weight_kg": 75.0}
    res = await client.post("/api/measurements", json=payload)
    assert res.status_code == 400
    assert "User profile not found" in res.json()["detail"]


@pytest.mark.asyncio
async def test_create_measurement_with_auto_bmi_and_optional_fields(
    client: AsyncClient,
):
    # Setup profile with height 180 cm
    await client.post(
        "/api/profile", json={"name": "George", "height_cm": 180.0}
    )

    # Log measurement: 81.0 kg, 15% body fat, no explicit fat_mass_kg
    # BMI should be 81 / (1.8^2) = 25.0 (calculated)
    # Optional field fat_mass_kg should remain None (not silently fabricated)
    res = await client.post(
        "/api/measurements",
        json={
            "weight_kg": 81.0,
            "body_fat_percentage": 15.0,
            "source": "manual",
            "notes": "Morning weigh-in",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["weight_kg"] == 81.0
    assert data["bmi"] == 25.0
    assert data["bmi_calculated"] is True
    assert data["fat_mass_kg"] is None  # Optional remains genuinely optional
    assert data["source"] == "manual"
    assert data["notes"] == "Morning weigh-in"
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_bmi_preserves_history_when_profile_height_changes(
    client: AsyncClient,
):
    # 1. Profile created with height 180 cm
    await client.post(
        "/api/profile", json={"name": "George", "height_cm": 180.0}
    )

    # 2. Measurement 1 logged with weight 81.0 kg -> BMI = 81 / (1.8^2) = 25.0
    res1 = await client.post("/api/measurements", json={"weight_kg": 81.0})
    assert res1.status_code == 201
    m1 = res1.json()
    assert m1["bmi"] == 25.0
    assert m1["bmi_calculated"] is True

    # 3. User profile height changes later to 160.0 cm
    patch_res = await client.patch("/api/profile", json={"height_cm": 160.0})
    assert patch_res.status_code == 200

    # 4. Old measurement 1 record must NOT silently change
    m1_get = await client.get(f"/api/measurements/{m1['id']}")
    assert m1_get.status_code == 200
    assert m1_get.json()["bmi"] == 25.0
    assert m1_get.json()["bmi_calculated"] is True

    # 5. New measurement 2 logged with weight 81.0 kg uses current height (160 cm -> BMI 31.6)
    res2 = await client.post("/api/measurements", json={"weight_kg": 81.0})
    assert res2.status_code == 201
    assert res2.json()["bmi"] == 31.6
    assert res2.json()["bmi_calculated"] is True


@pytest.mark.asyncio
async def test_create_measurement_explicit_bmi_and_height(client: AsyncClient):
    await client.post(
        "/api/profile", json={"name": "Maria", "height_cm": 165.0}
    )

    # Pass explicit height and BMI
    res = await client.post(
        "/api/measurements",
        json={
            "weight_kg": 60.0,
            "height_cm": 166.0,
            "bmi": 21.8,
            "waist_circumference_cm": 70.0,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["height_cm"] == 166.0
    assert data["bmi"] == 21.8
    assert data["bmi_calculated"] is False
    assert data["waist_circumference_cm"] == 70.0


@pytest.mark.asyncio
async def test_create_measurement_validation_no_metrics(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Test"})
    res = await client.post(
        "/api/measurements", json={"source": "manual", "notes": "No metrics"}
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_measurement_validation_out_of_bounds(
    client: AsyncClient,
):
    await client.post("/api/profile", json={"name": "Test"})

    # Negative weight
    res1 = await client.post("/api/measurements", json={"weight_kg": -10.0})
    assert res1.status_code == 422

    # Zero weight (distinguish missing from 0)
    res2 = await client.post("/api/measurements", json={"weight_kg": 0.0})
    assert res2.status_code == 422

    # Body fat > 75%
    res3 = await client.post(
        "/api/measurements", json={"body_fat_percentage": 95.0}
    )
    assert res3.status_code == 422


@pytest.mark.asyncio
async def test_measurement_history_ordering_and_pagination(
    client: AsyncClient,
):
    await client.post(
        "/api/profile", json={"name": "Athlete", "height_cm": 175.0}
    )

    now = datetime.now(timezone.utc)
    # Insert 3 measurements on consecutive days
    for i in range(3):
        m_date = (now - timedelta(days=2 - i)).isoformat()
        res = await client.post(
            "/api/measurements",
            json={
                "measured_at": m_date,
                "weight_kg": 70.0 + i,
            },
        )
        assert res.status_code == 201

    # Fetch list
    list_res = await client.get("/api/measurements?page=1&page_size=2")
    assert list_res.status_code == 200
    page_data = list_res.json()
    assert page_data["total"] == 3
    assert page_data["page"] == 1
    assert page_data["page_size"] == 2
    assert page_data["total_pages"] == 2
    assert len(page_data["items"]) == 2

    # Order should be newest first: weight_kg 72.0 then 71.0
    assert page_data["items"][0]["weight_kg"] == 72.0
    assert page_data["items"][1]["weight_kg"] == 71.0

    # Page 2
    page2_res = await client.get("/api/measurements?page=2&page_size=2")
    assert page2_res.status_code == 200
    page2_data = page2_res.json()
    assert len(page2_data["items"]) == 1
    assert page2_data["items"][0]["weight_kg"] == 70.0


@pytest.mark.asyncio
async def test_get_latest_and_by_id_and_delete(client: AsyncClient):
    await client.post(
        "/api/profile", json={"name": "Elena", "height_cm": 168.0}
    )

    # Empty initially
    latest_empty = await client.get("/api/measurements/latest")
    assert latest_empty.status_code == 200
    assert latest_empty.json() is None

    create_res = await client.post(
        "/api/measurements", json={"weight_kg": 62.0}
    )
    measurement_id = create_res.json()["id"]

    # Latest should return this one
    latest_res = await client.get("/api/measurements/latest")
    assert latest_res.status_code == 200
    assert latest_res.json()["id"] == measurement_id

    # Get by ID
    get_res = await client.get(f"/api/measurements/{measurement_id}")
    assert get_res.status_code == 200
    assert get_res.json()["weight_kg"] == 62.0

    # Delete
    del_res = await client.delete(f"/api/measurements/{measurement_id}")
    assert del_res.status_code == 204

    # Now get by ID returns 404
    get_after_del = await client.get(f"/api/measurements/{measurement_id}")
    assert get_after_del.status_code == 404

