import datetime
import pytest
from httpx import AsyncClient

from app.db.seed_generic_foods import seed_generic_foods
from app.db.seed_recipes import seed_built_in_recipes
from app.services.meal_planner_service import matches_disliked
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def seed_test_data():
    db = TestSessionLocal()
    try:
        seed_generic_foods(db)
        seed_built_in_recipes(db)
    finally:
        db.close()


def test_disliked_food_exact_word_boundaries():
    # Crucial test from user requirements:
    # "olives" should exclude "olives", "fresh olives", "black olives"
    # but NOT "olive oil" or "extra virgin olive oil"!
    disliked = ["olives"]
    assert matches_disliked("Salad with Olives", disliked) is True
    assert matches_disliked("Bowl of Black Olives", disliked) is True
    assert matches_disliked("Olive Oil Dressing", disliked) is False
    assert matches_disliked("Extra Virgin Olive Oil", disliked) is False
    assert matches_disliked("olives", disliked) is True

    # "nut" should not match "nutrition" or "peanut" (if exact word match)
    assert matches_disliked("Daily Nutrition", ["nut"]) is False
    assert matches_disliked("Peanut Butter", ["nut"]) is False
    assert matches_disliked("Mixed Nut Bowl", ["nut"]) is True


@pytest.mark.asyncio
async def test_built_in_recipes_seeded(client: AsyncClient):
    # Retrieve recipes list
    res = await client.get("/api/recipes")
    assert res.status_code == 200
    recipes = res.json()
    assert len(recipes) >= 12
    # Verify built-in recipes have valid nutrition
    for r in recipes:
        assert r["per_serving_calories"] > 0
        assert r["servings"] >= 1


@pytest.mark.asyncio
async def test_recipe_crud_and_protection(client: AsyncClient):
    # 1. Built-in recipe cannot be modified or deleted
    res = await client.get("/api/recipes")
    built_in = next(r for r in res.json() if r["is_built_in"])

    put_res = await client.put(f"/api/recipes/{built_in['id']}", json={"name": "Hacked Name"})
    assert put_res.status_code == 403

    del_res = await client.delete(f"/api/recipes/{built_in['id']}")
    assert del_res.status_code == 403

    # 2. Search for food to use in custom recipe
    food_res = await client.get("/api/foods?search=oats")
    food_id = food_res.json()["items"][0]["id"]

    # 3. Create custom recipe
    create_res = await client.post(
        "/api/recipes",
        json={
            "name": "Custom Power Oats",
            "meal_category": "breakfast",
            "servings": 2,
            "prep_time_minutes": 5,
            "cook_time_minutes": 5,
            "ingredients": [
                {"food_id": food_id, "quantity": 100.0, "unit": "g"}
            ],
        },
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["is_built_in"] is False
    assert created["servings"] == 2
    assert created["per_serving_calories"] > 0
    custom_id = created["id"]

    # 4. Update custom recipe
    update_res = await client.put(
        f"/api/recipes/{custom_id}",
        json={"name": "Super Custom Power Oats", "servings": 1},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Super Custom Power Oats"
    assert update_res.json()["servings"] == 1

    # 5. Delete custom recipe
    del_custom = await client.delete(f"/api/recipes/{custom_id}")
    assert del_custom.status_code == 204


@pytest.mark.asyncio
async def test_generate_meal_plan_and_isolation_from_food_diary(client: AsyncClient):
    # Ensure profile exists
    await client.post("/api/profile", json={"name": "Jordan", "height_cm": 180.0})

    # Set daily goals
    await client.put(
        "/api/nutrition/goals",
        json={"calories_kcal": 2100.0, "protein_g": 140.0, "carbs_g": 220.0, "fat_g": 70.0, "fiber_g": 30.0},
    )

    # 1. Generate 7-day plan
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Jordan's High Protein Week",
            "target_calories": 2100.0,
            "target_protein": 140.0,
            "simplicity_preference": "simple",
            "disliked_foods": ["olives"],  # Olives excluded, but olive oil allowed!
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()
    assert plan["id"] > 0
    assert len(plan["days"]) == 7

    # Verify each day has planned meals
    for day in plan["days"]:
        assert len(day["meals"]) >= 3
        assert day["total_calories"] > 0

    # Weekly overview should report adherence
    assert plan["weekly_overview"]["average_daily_calories"] > 1000.0
    assert plan["weekly_overview"]["adherence_calories_pct"] is not None

    # CRITICAL CHECK: Food diary (meal_logs) MUST BE EMPTY!
    # Planned meals NEVER enter actual food diary automatically.
    today_str = datetime.date.today().isoformat()
    diary_res = await client.get(f"/api/meal-logs/summary?date={today_str}")
    assert diary_res.status_code == 200
    assert diary_res.json()["totals"]["calories_kcal"] == 0.0
    assert diary_res.json()["total_entries"] == 0

    # 2. Explicit logging of a planned meal
    first_meal = plan["days"][0]["meals"][0]
    first_meal_id = first_meal["id"]

    log_res = await client.post(
        "/api/meal-plans/log-meals",
        json={
            "target_date": today_str,
            "planned_meal_id": first_meal_id,
            "skip_if_already_logged": True,
        },
    )
    assert log_res.status_code == 200
    log_data = log_res.json()
    assert log_data["success"] is True
    assert log_data["logged_count"] > 0

    # Diary should now reflect logged meal items
    diary_res2 = await client.get(f"/api/meal-logs/summary?date={today_str}")
    assert diary_res2.json()["totals"]["calories_kcal"] > 0.0
    assert diary_res2.json()["total_entries"] == log_data["logged_count"]

    # 3. Duplicate Prevention: Logging same planned meal again should skip
    log_dup_res = await client.post(
        "/api/meal-plans/log-meals",
        json={
            "target_date": today_str,
            "planned_meal_id": first_meal_id,
            "skip_if_already_logged": True,
        },
    )
    assert log_dup_res.status_code == 200
    assert log_dup_res.json()["logged_count"] == 0
    assert log_dup_res.json()["skipped_count"] == log_data["logged_count"]

    # Diary count remains identical (no duplicates added)
    diary_res3 = await client.get(f"/api/meal-logs/summary?date={today_str}")
    assert diary_res3.json()["total_entries"] == log_data["logged_count"]


@pytest.mark.asyncio
async def test_shopping_list_and_export(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 175.0})

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Shopping List Test Plan"},
    )
    plan_id = gen_res.json()["id"]

    # 1. Fetch shopping list
    shop_res = await client.get(f"/api/meal-plans/{plan_id}/shopping-list")
    assert shop_res.status_code == 200
    items = shop_res.json()
    assert len(items) > 0
    first_item = items[0]
    assert first_item["total_quantity"] > 0
    assert first_item["is_checked"] is False

    # 2. Toggle check state
    toggle_res = await client.put(
        f"/api/meal-plans/shopping-list/{first_item['id']}",
        json={"is_checked": True},
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_checked"] is True

    # 3. Export shopping list
    export_res = await client.get(f"/api/meal-plans/{plan_id}/shopping-list/export")
    assert export_res.status_code == 200
    export_data = export_res.json()
    assert export_data["total_items_count"] == len(items)
    assert export_data["checked_items_count"] == 1
    assert "Shopping List:" in export_data["plain_text"]
    assert "[x]" in export_data["plain_text"]


@pytest.mark.asyncio
async def test_backup_v1_2_export_and_v1_1_backward_compatibility(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Taylor", "height_cm": 172.0})

    # 1. Export v1.2 backup
    exp_res = await client.get("/api/nutrition/export")
    assert exp_res.status_code == 200
    backup = exp_res.json()
    assert backup["version"] == "1.2"
    assert "recipes" in backup
    assert "meal_plans" in backup

    # 2. Test backward compatibility: restore a v1.1 backup format
    legacy_backup = {
        "version": "1.1",
        "foods": [],
        "meal_logs": [],
        "nutrition_goals": {
            "calories_kcal": 2400.0,
            "protein_g": 170.0,
            "carbs_g": 260.0,
            "fat_g": 75.0,
            "fiber_g": 35.0,
        },
    }
    imp_res = await client.post("/api/nutrition/import", json=legacy_backup)
    assert imp_res.status_code == 200
    assert imp_res.json()["success"] is True
    assert imp_res.json()["imported_goals"] is True

    # Verify goals were updated from legacy v1.1 restore
    check_goals = await client.get("/api/nutrition/goals")
    assert check_goals.json()["calories_kcal"] == 2400.0
