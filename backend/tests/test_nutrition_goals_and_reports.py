from datetime import date, datetime, timedelta
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_goals_initial(client: AsyncClient):
    # Setup profile
    res_prof = await client.post(
        "/api/profile",
        json={"name": "Sarah", "height_cm": 165.0, "sex": "female", "activity_level": "moderately_active"},
    )
    assert res_prof.status_code == 201

    res = await client.get("/api/nutrition/goals")
    assert res.status_code == 200
    data = res.json()
    assert data["calories_kcal"] is None
    assert data["protein_g"] is None


@pytest.mark.asyncio
async def test_update_goals_valid(client: AsyncClient):
    await client.post(
        "/api/profile",
        json={"name": "Sarah", "height_cm": 165.0, "sex": "female"},
    )

    payload = {
        "calories_kcal": 2100.0,
        "protein_g": 140.0,
        "carbs_g": 220.0,
        "fat_g": 70.0,
        "fiber_g": 30.0,
    }
    put_res = await client.put("/api/nutrition/goals", json=payload)
    assert put_res.status_code == 200
    data = put_res.json()
    assert data["calories_kcal"] == 2100.0
    assert data["protein_g"] == 140.0
    assert data["carbs_g"] == 220.0
    assert data["fat_g"] == 70.0
    assert data["fiber_g"] == 30.0

    # Retrieve again to verify persistence
    get_res = await client.get("/api/nutrition/goals")
    assert get_res.status_code == 200
    assert get_res.json()["calories_kcal"] == 2100.0


@pytest.mark.asyncio
async def test_update_goals_validation_errors(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Sarah", "height_cm": 165.0})

    # Negative calories
    res1 = await client.put("/api/nutrition/goals", json={"calories_kcal": -100})
    assert res1.status_code == 422

    # Negative protein
    res2 = await client.put("/api/nutrition/goals", json={"protein_g": -5.0})
    assert res2.status_code == 422

    # Unrealistic upper bound
    res3 = await client.put("/api/nutrition/goals", json={"calories_kcal": 50000.0})
    assert res3.status_code == 422


@pytest.mark.asyncio
async def test_partial_goals_and_unset(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Sarah", "height_cm": 165.0})

    # Set only calories and protein; leave others unset (None)
    res = await client.put(
        "/api/nutrition/goals",
        json={"calories_kcal": 1800.0, "protein_g": 120.0},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["calories_kcal"] == 1800.0
    assert data["protein_g"] == 120.0
    assert data["carbs_g"] is None
    assert data["fat_g"] is None
    assert data["fiber_g"] is None


@pytest.mark.asyncio
async def test_estimate_goals(client: AsyncClient):
    prof_res = await client.post(
        "/api/profile",
        json={
            "name": "Alex",
            "date_of_birth": "1994-05-15",
            "sex": "male",
            "height_cm": 180.0,
            "activity_level": "moderately_active",
        },
    )
    assert prof_res.status_code == 201

    # Log a measurement with weight
    meas_res = await client.post(
        "/api/measurements",
        json={
            "measured_at": datetime.now().isoformat(),
            "weight_kg": 75.0,
            "source": "manual",
        },
    )
    assert meas_res.status_code == 201

    res = await client.get("/api/nutrition/goals/estimate")
    assert res.status_code == 200
    data = res.json()
    assert data["bmr_kcal"] > 1000.0
    assert data["tdee_kcal"] > data["bmr_kcal"]
    assert data["protein_g"] > 0
    assert data["carbs_g"] > 0
    assert data["fat_g"] > 0
    assert data["fiber_g"] > 0
    assert "Mifflin-St Jeor" in data["formula_explanation"]


@pytest.mark.asyncio
async def test_historical_report_with_logged_and_unlogged_days(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 178.0})

    # Create food
    food_res = await client.post(
        "/api/foods",
        json={
            "name": "Oatmeal Bowl",
            "nutritional_basis": "100g",
            "calories_kcal": 300.0,
            "protein_g": 10.0,
            "carbs_g": 50.0,
            "fat_g": 6.0,
            "fiber_g": 8.0,
        },
    )
    food_id = food_res.json()["id"]

    today = date.today()
    day1 = (today - timedelta(days=2)).isoformat()
    day2 = (today - timedelta(days=1)).isoformat()
    day3 = today.isoformat()

    # Log meals on day 1 and day 3, leaving day 2 empty
    await client.post(
        "/api/meal-logs",
        json={
            "logged_date": day1,
            "meal_category": "breakfast",
            "food_id": food_id,
            "quantity": 100.0,
            "unit": "g",
        },
    )
    await client.post(
        "/api/meal-logs",
        json={
            "logged_date": day3,
            "meal_category": "breakfast",
            "food_id": food_id,
            "quantity": 200.0,  # 600 kcal
            "unit": "g",
        },
    )

    start_str = (today - timedelta(days=2)).isoformat()
    end_str = today.isoformat()

    report_res = await client.get(
        f"/api/nutrition/reports?start_date={start_str}&end_date={end_str}"
    )
    assert report_res.status_code == 200
    rep = report_res.json()

    assert rep["total_days"] == 3
    assert rep["days_with_logs"] == 2
    assert rep["days_without_logs"] == 1

    # Total calories = 300 + 600 = 900
    # Average across the 2 logged days = 450 kcal (not 300 kcal across 3 days!)
    assert rep["avg_calories_kcal"] == 450.0
    assert rep["avg_protein_g"] == 15.0
    assert "Days without logged meals are excluded" in rep["calculation_note"]


@pytest.mark.asyncio
async def test_historical_report_weight_trend(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 178.0})

    today = date.today()
    d1 = datetime.combine(today - timedelta(days=6), datetime.min.time()).isoformat()
    d2 = datetime.combine(today, datetime.min.time()).isoformat()

    # Log 2 measurements across a 7-day period
    await client.post(
        "/api/measurements",
        json={"measured_at": d1, "weight_kg": 80.0, "source": "manual"},
    )
    await client.post(
        "/api/measurements",
        json={"measured_at": d2, "weight_kg": 79.2, "source": "manual"},
    )

    start_str = (today - timedelta(days=6)).isoformat()
    end_str = today.isoformat()

    res = await client.get(
        f"/api/nutrition/reports?start_date={start_str}&end_date={end_str}"
    )
    assert res.status_code == 200
    data = res.json()
    trend = data["weight_trend"]

    assert trend["has_sufficient_data"] is True
    assert trend["measurement_count"] == 2
    assert trend["start_weight_kg"] == 80.0
    assert trend["end_weight_kg"] == 79.2
    assert trend["weight_change_kg"] == -0.8
    assert "historical observations" in trend["disclaimer"]


@pytest.mark.asyncio
async def test_backup_export_and_import_with_goals(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 178.0})

    # 1. Set goals
    await client.put(
        "/api/nutrition/goals",
        json={"calories_kcal": 2250.0, "protein_g": 160.0, "carbs_g": 240.0, "fat_g": 70.0},
    )

    # 2. Export backup
    exp_res = await client.get("/api/nutrition/export")
    assert exp_res.status_code == 200
    backup = exp_res.json()
    assert backup["version"] in ("1.1", "1.2")
    assert backup["nutrition_goals"] is not None
    assert backup["nutrition_goals"]["calories_kcal"] == 2250.0
    assert backup["nutrition_goals"]["protein_g"] == 160.0

    # 3. Change current goals to something else
    await client.put(
        "/api/nutrition/goals",
        json={"calories_kcal": 1500.0, "protein_g": 80.0},
    )
    check_res = await client.get("/api/nutrition/goals")
    assert check_res.json()["calories_kcal"] == 1500.0

    # 4. Restore from backup
    imp_res = await client.post("/api/nutrition/import", json=backup)
    assert imp_res.status_code == 200
    imp_data = imp_res.json()
    assert imp_data["success"] is True
    assert imp_data["imported_goals"] is True

    # 5. Verify goals restored to 2250.0
    restored_res = await client.get("/api/nutrition/goals")
    assert restored_res.json()["calories_kcal"] == 2250.0
    assert restored_res.json()["protein_g"] == 160.0

    # 6. Backwards compatibility: restore backup version 1.0 without nutrition_goals field
    legacy_backup = {
        "version": "1.0",
        "foods": [],
        "meal_logs": [],
    }
    legacy_res = await client.post("/api/nutrition/import", json=legacy_backup)
    assert legacy_res.status_code == 200
    assert legacy_res.json()["success"] is True
    # Existing goals remain intact
    restored_res2 = await client.get("/api/nutrition/goals")
    assert restored_res2.json()["calories_kcal"] == 2250.0


@pytest.mark.asyncio
async def test_generate_goal_profiles_success(client: AsyncClient):
    # Setup profile with valid metrics
    await client.post(
        "/api/profile",
        json={
            "name": "Alex",
            "date_of_birth": "1994-05-15",
            "sex": "male",
            "height_cm": 180.0,
            "activity_level": "moderately_active",
        },
    )
    # Record weight measurement
    await client.post(
        "/api/measurements",
        json={"weight_kg": 80.0, "measured_at": "2026-10-28T08:00:00Z"},
    )
    # Set manual goals first to test preservation
    await client.put(
        "/api/nutrition/goals",
        json={"calories_kcal": 2000.0, "protein_g": 150.0, "carbs_g": 200.0, "fat_g": 65.0},
    )

    # Call generate goals
    res = await client.get("/api/nutrition/goals/generate")
    assert res.status_code == 200
    data = res.json()

    assert data["weight_kg"] == 80.0
    assert data["height_cm"] == 180.0
    assert data["sex"] == "male"
    assert len(data["profiles"]) == 3

    keys = [p["key"] for p in data["profiles"]]
    assert "weight_loss" in keys
    assert "sustainability" in keys
    assert "bulking" in keys

    # Verify each profile satisfies exact Atwater consistency and logical relationships
    profiles_by_key = {p["key"]: p for p in data["profiles"]}
    p_loss = profiles_by_key["weight_loss"]
    p_sustain = profiles_by_key["sustainability"]
    p_bulk = profiles_by_key["bulking"]

    # Weight loss < Sustainability < Bulking calories
    assert p_loss["calories_kcal"] < p_sustain["calories_kcal"] < p_bulk["calories_kcal"]

    for prof in data["profiles"]:
        # Strict Atwater macro reconciliation
        macro_sum = 4.0 * prof["protein_g"] + 4.0 * prof["carbs_g"] + 9.0 * prof["fat_g"]
        assert prof["calories_kcal"] == macro_sum, f"Atwater mismatch for {prof['key']}"
        assert prof["protein_g"] > 0
        assert prof["carbs_g"] > 0
        assert prof["fat_g"] > 0
        assert prof["fiber_g"] > 0

    # Ensure manual goals are PRESERVED after viewing generated profiles
    current_goals = (await client.get("/api/nutrition/goals")).json()
    assert current_goals["calories_kcal"] == 2000.0
    assert current_goals["protein_g"] == 150.0

    # Explicit application of Sustainability profile
    apply_res = await client.put(
        "/api/nutrition/goals",
        json={
            "calories_kcal": p_sustain["calories_kcal"],
            "protein_g": p_sustain["protein_g"],
            "carbs_g": p_sustain["carbs_g"],
            "fat_g": p_sustain["fat_g"],
            "fiber_g": p_sustain["fiber_g"],
        },
    )
    assert apply_res.status_code == 200
    updated_goals = (await client.get("/api/nutrition/goals")).json()
    assert updated_goals["calories_kcal"] == p_sustain["calories_kcal"]
    assert updated_goals["protein_g"] == p_sustain["protein_g"]


@pytest.mark.asyncio
async def test_generate_goal_profiles_missing_inputs(client: AsyncClient):
    # Empty profile (no weight, no height, no sex, no dob)
    await client.post("/api/profile", json={"name": "Incomplete"})

    res = await client.get("/api/nutrition/goals/generate")
    assert res.status_code == 400
    assert "required" in res.json()["detail"].lower()
