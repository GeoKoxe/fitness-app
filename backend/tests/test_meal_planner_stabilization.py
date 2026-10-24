import datetime
import pytest
from httpx import AsyncClient

from app.db.seed_generic_foods import seed_generic_foods
from app.db.seed_recipes import seed_built_in_recipes
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def seed_test_data():
    db = TestSessionLocal()
    try:
        seed_generic_foods(db)
        seed_built_in_recipes(db)
    finally:
        db.close()


@pytest.mark.asyncio
async def test_bug1_planned_meals_logged_to_daily_log(client: AsyncClient):
    """Bug 1: Logging a planned meal adds entries to Daily Log with correct quantities and prevents duplicates."""
    await client.post("/api/profile", json={"name": "Chris", "height_cm": 180.0, "activity_level": "moderately_active"})
    await client.put("/api/nutrition/goals", json={"calories_kcal": 2100, "protein_g": 130})

    # 1. Generate plan
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Chris Week 1", "target_calories": 2100, "target_protein": 130},
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()
    first_meal = plan["days"][0]["meals"][0]
    meal_id = first_meal["id"]
    category = first_meal["meal_category"]

    log_date = "2026-11-02"

    # 2. Log planned meal
    log_res = await client.post(
        "/api/meal-plans/log-meals",
        json={
            "target_date": log_date,
            "planned_meal_id": meal_id,
            "skip_if_already_logged": True,
        },
    )
    assert log_res.status_code == 200
    log_data = log_res.json()
    assert log_data["success"] is True
    assert log_data["logged_count"] > 0
    assert len(log_data["logged_items"]) == log_data["logged_count"]

    # 3. Verify Daily Log summary received the records
    summary_res = await client.get(f"/api/meal-logs/summary?date={log_date}")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_entries"] == log_data["logged_count"]
    assert summary["totals"]["calories_kcal"] > 0
    # Items should be in the category list
    cat_key = category.lower().strip()
    if cat_key == "snack":
        cat_key = "snacks"
    assert len(summary["by_category"][cat_key]) == log_data["logged_count"]

    # 4. Duplicate prevention test: logging same meal again with skip_if_already_logged=True
    repeat_res = await client.post(
        "/api/meal-plans/log-meals",
        json={
            "target_date": log_date,
            "planned_meal_id": meal_id,
            "skip_if_already_logged": True,
        },
    )
    assert repeat_res.status_code == 200
    repeat_data = repeat_res.json()
    assert repeat_data["logged_count"] == 0
    assert repeat_data["skipped_count"] == log_data["logged_count"]

    # Verify summary count has not increased
    summary_after = (await client.get(f"/api/meal-logs/summary?date={log_date}")).json()
    assert summary_after["total_entries"] == log_data["logged_count"]


@pytest.mark.asyncio
async def test_bug2_whole_numbers_for_all_nutrition_goals(client: AsyncClient):
    """Bug 2: Suggested goals and manual goals are standardized to whole numbers."""
    await client.post(
        "/api/profile",
        json={
            "name": "Jordan",
            "date_of_birth": "1990-03-20",
            "sex": "male",
            "height_cm": 182.5,
            "activity_level": "moderately_active",
        },
    )

    # 1. Suggested estimates should all be whole numbers
    est_res = await client.get("/api/nutrition/goals/estimate")
    assert est_res.status_code == 200
    est = est_res.json()
    for field in ["calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"]:
        val = est[field]
        assert val == round(val), f"{field} should be an integer, got {val}"

    # 2. Saving goals with decimals normalizes them to integers safely
    save_res = await client.put(
        "/api/nutrition/goals",
        json={
            "calories_kcal": 2150.8,
            "protein_g": 142.3,
            "carbs_g": 235.6,
            "fat_g": 66.4,
            "fiber_g": 29.9,
        },
    )
    assert save_res.status_code == 200
    saved = save_res.json()
    assert saved["calories_kcal"] == 2151
    assert saved["protein_g"] == 142
    assert saved["carbs_g"] == 236
    assert saved["fat_g"] == 66
    assert saved["fiber_g"] == 30

    # 3. Explicitly setting unset goals to None preserves them as None
    partial_res = await client.put(
        "/api/nutrition/goals",
        json={
            "calories_kcal": 2000,
            "protein_g": 130,
            "carbs_g": None,
            "fat_g": None,
            "fiber_g": None,
        },
    )
    assert partial_res.status_code == 200
    partial_saved = partial_res.json()
    assert partial_saved["calories_kcal"] == 2000
    assert partial_saved["protein_g"] == 130
    assert partial_saved["carbs_g"] is None
    assert partial_saved["fat_g"] is None
    assert partial_saved["fiber_g"] is None


@pytest.mark.asyncio
async def test_bug5_actual_selected_target_tolerance_displayed(client: AsyncClient):
    """Bug 5: Display actual tolerance used to generate the plan across 10%, 12%, 15%."""
    await client.post("/api/profile", json={"name": "Sam", "height_cm": 175.0})
    await client.put("/api/nutrition/goals", json={"calories_kcal": 2000, "protein_g": 120})

    # Test 12% tolerance
    res_12 = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Plan 12", "target_tolerance_pct": 12.0},
    )
    assert res_12.status_code == 201
    plan_12 = res_12.json()
    assert plan_12["target_tolerance_pct"] == 12.0
    assert plan_12["weekly_overview"]["tolerance_pct"] == 12.0

    # Fetch active plan again to verify persistence
    active_res = await client.get("/api/meal-plans/active")
    assert active_res.status_code == 200
    active_plan = active_res.json()
    assert active_plan["target_tolerance_pct"] == 12.0
    assert active_plan["weekly_overview"]["tolerance_pct"] == 12.0

    # Test 15% tolerance
    res_15 = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Plan 15", "target_tolerance_pct": 15.0},
    )
    assert res_15.status_code == 201
    plan_15 = res_15.json()
    assert plan_15["target_tolerance_pct"] == 15.0
    assert plan_15["weekly_overview"]["tolerance_pct"] == 15.0


@pytest.mark.asyncio
async def test_bug6_persist_disliked_foods_entered_during_generate(client: AsyncClient):
    """Bug 6: Disliked foods entered in generation request are saved to persistent disliked_foods list."""
    await client.post("/api/profile", json={"name": "Robin", "height_cm": 175.0})
    await client.put("/api/nutrition/goals", json={"calories_kcal": 2000, "protein_g": 120})

    # Generate plan with disliked foods
    res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Robin Week",
            "disliked_foods": ["  mushrooms  ", "olives", "mushrooms"],  # test whitespace & duplicates
        },
    )
    assert res.status_code == 201

    # Check persistent disliked foods endpoint
    df_res = await client.get("/api/meal-plans/disliked-foods")
    assert df_res.status_code == 200
    df_list = df_res.json()
    names = [d["food_name"].lower() for d in df_list]
    assert "mushrooms" in names
    assert "olives" in names
    # Ensure no duplicates
    assert names.count("mushrooms") == 1
