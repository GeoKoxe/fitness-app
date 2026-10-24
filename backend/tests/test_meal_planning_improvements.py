import datetime
import pytest
from httpx import AsyncClient

from app.db.seed_generic_foods import seed_generic_foods
from app.db.seed_recipes import seed_built_in_recipes
from app.domain.nutrition import round_portion_quantity, validate_portion_quantity
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def seed_test_data():
    db = TestSessionLocal()
    try:
        seed_generic_foods(db)
        seed_built_in_recipes(db)
    finally:
        db.close()


def test_portion_quantity_rules_and_validation():
    # Weight and volume: multiples of 5
    assert round_portion_quantity(21.4, "g") == 20.0
    assert round_portion_quantity(23.0, "g") == 25.0
    assert round_portion_quantity(1.5, "g") == 5.0
    assert round_portion_quantity(148.0, "ml") == 150.0

    valid_g, msg = validate_portion_quantity(25.0, "g")
    assert valid_g is True
    invalid_g, msg = validate_portion_quantity(23.4, "g")
    assert invalid_g is False

    # Count-based units: whole counts
    assert round_portion_quantity(1.4, "serving") == 1.0
    assert round_portion_quantity(2.8, "egg") == 3.0
    valid_count, _ = validate_portion_quantity(2.0, "serving")
    assert valid_count is True
    invalid_count, _ = validate_portion_quantity(1.5, "serving")
    assert invalid_count is False


@pytest.mark.asyncio
async def test_dislike_ingredient_and_targeted_regeneration(client: AsyncClient):
    # Setup profile & goals
    await client.post("/api/profile", json={"name": "Morgan", "height_cm": 178.0})
    await client.put("/api/nutrition/goals", json={"calories_kcal": 2000.0, "protein_g": 120.0})

    # 1. Generate 7-day meal plan
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Morgan's Weekly Plan", "target_calories": 2000.0, "target_protein": 120.0},
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Find a planned meal containing an ingredient we can dislike (e.g. "Tuna" or "Chicken")
    target_meal = None
    target_ingredient = None
    for day in plan["days"]:
        for meal in day["meals"]:
            for it in meal["items"]:
                if "tuna" in it["food_name"].lower() or "chicken" in it["food_name"].lower():
                    target_meal = meal
                    target_ingredient = it
                    break
            if target_meal:
                break
        if target_meal:
            break

    assert target_meal is not None
    assert target_ingredient is not None

    disliked_food_name = target_ingredient["food_name"]
    affected_meal_id = target_meal["id"]

    # Record an unaffected meal from another day to verify it remains identical
    unaffected_day = [d for d in plan["days"] if d["day_number"] != target_meal["day_number"]][0]
    unaffected_meal = unaffected_day["meals"][0]
    unaffected_meal_id = unaffected_meal["id"]
    unaffected_meal_name = unaffected_meal["name"]
    unaffected_meal_cal = unaffected_meal["calories_kcal"]

    # 2. Trigger dislike and targeted regeneration
    dislike_res = await client.post(
        "/api/meal-plans/dislike-and-regenerate",
        json={
            "food_id": target_ingredient["food_id"],
            "food_name": disliked_food_name,
        },
    )
    assert dislike_res.status_code == 200
    dislike_data = dislike_res.json()
    assert dislike_data["affected_meals_count"] >= 1
    assert dislike_data["regenerated_meals_count"] >= 1
    assert dislike_data["disliked_food"]["food_name"] == disliked_food_name

    # 3. Verify affected meal was replaced
    updated_plan = dislike_data["plan"]
    replaced_meal = None
    for day in updated_plan["days"]:
        for m in day["meals"]:
            if m["id"] == affected_meal_id:
                replaced_meal = m
                break
        if replaced_meal:
            break

    assert replaced_meal is not None
    # Replaced meal should no longer contain the disliked food
    for it in replaced_meal["items"]:
        assert it["food_id"] != target_ingredient["food_id"]
        assert disliked_food_name.lower() not in it["food_name"].lower()

    # 4. Verify unaffected meal was preserved intact
    persisted_unaffected = None
    for day in updated_plan["days"]:
        for m in day["meals"]:
            if m["id"] == unaffected_meal_id:
                persisted_unaffected = m
                break
        if persisted_unaffected:
            break

    assert persisted_unaffected is not None
    assert persisted_unaffected["name"] == unaffected_meal_name
    assert persisted_unaffected["calories_kcal"] == unaffected_meal_cal


@pytest.mark.asyncio
async def test_manage_disliked_foods_list(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Casey", "height_cm": 170.0})

    # 1. Add disliked food
    add_res = await client.post(
        "/api/meal-plans/disliked-foods",
        json={"food_name": "Mushrooms"},
    )
    assert add_res.status_code == 201
    disliked = add_res.json()
    assert disliked["id"] > 0
    assert disliked["food_name"] == "Mushrooms"
    disliked_id = disliked["id"]

    # 2. List disliked foods
    list_res = await client.get("/api/meal-plans/disliked-foods")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(i["id"] == disliked_id for i in items)

    # 3. Remove from disliked foods
    del_res = await client.delete(f"/api/meal-plans/disliked-foods/{disliked_id}")
    assert del_res.status_code == 204

    # 4. Verify list is now empty of that item
    list_res2 = await client.get("/api/meal-plans/disliked-foods")
    assert all(i["id"] != disliked_id for i in list_res2.json())


@pytest.mark.asyncio
async def test_daily_log_remove_all_by_category(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Sam", "height_cm": 175.0})
    today = datetime.date.today().isoformat()
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

    # Log 2 items to Breakfast today
    food_res = await client.get("/api/foods?search=oats")
    oats_id = food_res.json()["items"][0]["id"]

    await client.post(
        "/api/meal-logs",
        json={"logged_date": today, "meal_category": "breakfast", "food_id": oats_id, "quantity": 50.0, "unit": "g"},
    )
    await client.post(
        "/api/meal-logs",
        json={"logged_date": today, "meal_category": "breakfast", "food_id": oats_id, "quantity": 30.0, "unit": "g"},
    )

    # Log 1 item to Lunch today (should NOT be removed)
    await client.post(
        "/api/meal-logs",
        json={"logged_date": today, "meal_category": "lunch", "food_id": oats_id, "quantity": 50.0, "unit": "g"},
    )

    # Log 1 item to Breakfast yesterday (should NOT be removed)
    await client.post(
        "/api/meal-logs",
        json={"logged_date": yesterday, "meal_category": "breakfast", "food_id": oats_id, "quantity": 50.0, "unit": "g"},
    )

    # Verify breakfast has 2 items today
    summary_before = await client.get(f"/api/meal-logs/summary?date={today}")
    assert len(summary_before.json()["by_category"]["breakfast"]) == 2
    assert len(summary_before.json()["by_category"]["lunch"]) == 1

    # Remove All Breakfast today
    del_res = await client.delete(f"/api/meal-logs/category?date={today}&meal_category=breakfast")
    assert del_res.status_code == 200
    assert del_res.json()["deleted_count"] == 2

    # Verify Breakfast today is now 0
    summary_after = await client.get(f"/api/meal-logs/summary?date={today}")
    assert len(summary_after.json()["by_category"]["breakfast"]) == 0
    # Lunch today is preserved
    assert len(summary_after.json()["by_category"]["lunch"]) == 1

    # Yesterday's breakfast is preserved
    summary_yesterday = await client.get(f"/api/meal-logs/summary?date={yesterday}")
    assert len(summary_yesterday.json()["by_category"]["breakfast"]) == 1


@pytest.mark.asyncio
async def test_portion_rules_and_no_1_5x_serving(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Robin", "height_cm": 182.0})

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Robin's Plan", "target_calories": 2200.0},
    )
    plan = gen_res.json()

    # All planned meal items in g or ml must be whole multiples of 5
    for day in plan["days"]:
        for meal in day["meals"]:
            assert meal["servings"] != 1.5  # No 1.5x serving option
            for it in meal["items"]:
                if it["unit"].lower() in ("g", "ml"):
                    assert it["quantity"] % 5 == 0, f"Quantity {it['quantity']} not multiple of 5!"
                    assert it["quantity"] >= 5.0
                elif it["unit"].lower() in ("serving", "unit"):
                    assert int(it["quantity"]) == it["quantity"]


@pytest.mark.asyncio
async def test_nutrition_target_tolerance_reporting(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Dana", "height_cm": 168.0})
    await client.put(
        "/api/nutrition/goals",
        json={"calories_kcal": 2000.0, "protein_g": 120.0, "carbs_g": 220.0, "fat_g": 65.0, "fiber_g": 30.0},
    )

    # Set tolerance to 12% in preferences
    pref_res = await client.put(
        "/api/meal-plans/preferences/me",
        json={"target_tolerance_pct": 12.0},
    )
    assert pref_res.status_code == 200
    assert pref_res.json()["target_tolerance_pct"] == 12.0

    # Generate plan
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Dana's Plan", "target_calories": 2000.0},
    )
    plan = gen_res.json()
    overview = plan["weekly_overview"]
    assert overview["tolerance_pct"] == 12.0
    # Unmet constraints array is present
    assert isinstance(overview["unmet_constraints"], list)

