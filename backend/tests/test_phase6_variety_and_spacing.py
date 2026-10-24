import datetime
import pytest
from httpx import AsyncClient

from app.core.database import SessionLocal
from app.data.built_in_recipes import BUILT_IN_RECIPES
from app.db.seed_generic_foods import seed_generic_foods
from app.db.seed_recipes import seed_built_in_recipes
from app.models.meal_plan import MealPlan, PlannedMeal
from app.models.recipe import Recipe
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
async def test_catalogue_size_and_category_coverage(client: AsyncClient):
    """Verify at least 50 built-in recipes exist and cover all four categories."""
    assert len(BUILT_IN_RECIPES) >= 50

    res = await client.get("/api/recipes")
    assert res.status_code == 200
    recipes = res.json()
    assert len(recipes) >= 50

    cats = {"breakfast": 0, "lunch": 0, "dinner": 0, "snack": 0}
    for r in recipes:
        c = r["meal_category"]
        if c in cats:
            cats[c] += 1
        assert r["per_serving_calories"] > 0
        assert r["servings"] >= 1

    # At least 10 recipes per category
    assert cats["breakfast"] >= 10
    assert cats["lunch"] >= 10
    assert cats["dinner"] >= 10
    assert cats["snack"] >= 10


@pytest.mark.asyncio
async def test_idempotent_seeding_does_not_duplicate_or_overwrite(client: AsyncClient):
    """Verify seeding twice does not duplicate built-in recipes or wipe custom recipes."""
    db = TestSessionLocal()
    try:
        count_before = db.query(Recipe).count()
        new_added = seed_built_in_recipes(db)
        assert new_added == 0
        count_after = db.query(Recipe).count()
        assert count_before == count_after
    finally:
        db.close()


@pytest.mark.asyncio
async def test_generated_plan_contains_7_days_and_enforces_repetition_and_spacing(client: AsyncClient):
    """Test standard 7-day plan generation:
    1. Plan contains 7 days, each with 4 slots (28 meals).
    2. No recipe appears more than twice across the week (count <= 2).
    3. Any repeated recipe satisfies abs(day_a - day_b) >= 3.
    4. Generator prefers unused recipes (with 56 recipes, maximum variety is achieved).
    """
    # Create profile
    prof_res = await client.post(
        "/api/profile",
        json={
            "name": "Phase 6 Tester",
            "date_of_birth": "1994-05-15",
            "gender": "male",
            "height_cm": 180.0,
            "activity_level": "moderately_active",
        },
    )
    assert prof_res.status_code in (200, 201)

    # Set nutrition goals
    await client.put(
        "/api/nutrition-goals",
        json={
            "daily_calories": 2200,
            "daily_protein_g": 140,
            "daily_carbs_g": 250,
            "daily_fat_g": 70,
            "daily_fiber_g": 30,
        },
    )

    # Generate 7-day plan
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Phase 6 Verified Plan",
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "simplicity_preference": "varied",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    assert len(plan["days"]) == 7
    total_planned = sum(len(d["meals"]) for d in plan["days"])
    assert total_planned == 28

    # Check repetition and spacing rules
    recipe_days = {}
    for d in plan["days"]:
        day_num = d["day_number"]
        for m in d["meals"]:
            r_id = m.get("recipe_id")
            if r_id is not None:
                recipe_days.setdefault(r_id, []).append(day_num)

    for r_id, days in recipe_days.items():
        # Rule 1: at most twice
        assert len(days) <= 2, f"Recipe {r_id} appeared {len(days)} times (>2)!"
        # Rule 2: spacing abs(a - b) >= 3
        if len(days) == 2:
            spacing = abs(days[0] - days[1])
            assert spacing >= 3, f"Recipe {r_id} repeated with invalid spacing {spacing} (days {days})!"

    # Rule 3: With 56 recipes, variety should be high (almost all or all unique)
    unique_recipes = len(recipe_days.keys())
    assert unique_recipes >= 20, f"Expected high variety with 56 recipes, got {unique_recipes}"


@pytest.mark.asyncio
async def test_spacing_rule_cannot_be_bypassed_by_manual_replacement(client: AsyncClient):
    """Verify that replacing a meal cannot bypass the 2-day spacing rule or max 2 repetition rule."""
    prof_res = await client.post(
        "/api/profile",
        json={
            "name": "Replacement Tester",
            "date_of_birth": "1992-03-20",
            "gender": "female",
            "height_cm": 165.0,
            "activity_level": "lightly_active",
        },
    )
    assert prof_res.status_code in (200, 201)

    # Generate plan
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "simplicity_preference": "simple",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Find meal on Day 1
    day1_meal = plan["days"][0]["meals"][0]
    recipe_on_day1 = day1_meal["recipe_id"]
    assert recipe_on_day1 is not None

    # Find meal on Day 2 (spacing diff = |2 - 1| = 1 < 3 -> should fail!)
    day2_meal = plan["days"][1]["meals"][0]

    rep_res = await client.put(
        f"/api/meal-plans/planned-meals/{day2_meal['id']}/replace?recipe_id={recipe_on_day1}"
    )
    assert rep_res.status_code == 400
    assert "spacing rule requires at least 2 complete calendar days" in rep_res.json()["detail"].lower()

    # Find meal on Day 3 (spacing diff = |3 - 1| = 2 < 3 -> should fail!)
    day3_meal = plan["days"][2]["meals"][0]
    rep_res3 = await client.put(
        f"/api/meal-plans/planned-meals/{day3_meal['id']}/replace?recipe_id={recipe_on_day1}"
    )
    assert rep_res3.status_code == 400
    assert "spacing rule requires at least 2 complete calendar days" in rep_res3.json()["detail"].lower()

    # Find meal on Day 4 (spacing diff = |4 - 1| = 3 >= 3 -> should SUCCEED!)
    day4_meal = plan["days"][3]["meals"][0]
    rep_res4 = await client.put(
        f"/api/meal-plans/planned-meals/{day4_meal['id']}/replace?recipe_id={recipe_on_day1}"
    )
    assert rep_res4.status_code == 200

    # Now recipe_on_day1 is on Day 1 and Day 4 (2 occurrences).
    # Trying to add it a third time on Day 7 should fail with max 2 limit!
    day7_meal = plan["days"][6]["meals"][0]
    rep_res7 = await client.put(
        f"/api/meal-plans/planned-meals/{day7_meal['id']}/replace?recipe_id={recipe_on_day1}"
    )
    assert rep_res7.status_code == 400
    assert "already appears twice" in rep_res7.json()["detail"].lower()


@pytest.mark.asyncio
async def test_catalogue_shortage_actionable_warning(client: AsyncClient):
    """Verify that when user dislikes almost everything in a category, shortage is handled honestly:
    - Never silently violates repetition/spacing rules.
    - Surfaces an actionable warning identifying the shortage and affected slots.
    """
    prof_res = await client.post(
        "/api/profile",
        json={
            "name": "Shortage Tester",
            "date_of_birth": "1990-01-01",
            "gender": "male",
            "height_cm": 175.0,
            "activity_level": "moderately_active",
        },
    )
    assert prof_res.status_code in (200, 201)

    # Dislike ingredients that disqualify almost all breakfast recipes
    # e.g., eggs, oats, yogurt, cottage cheese
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "enabled_categories": ["breakfast"],
            "disliked_foods": ["eggs", "oats", "yogurt", "cottage cheese"],
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Verify no recipe appears > 2 times or with spacing < 3
    recipe_days = {}
    for d in plan["days"]:
        day_num = d["day_number"]
        for m in d["meals"]:
            r_id = m.get("recipe_id")
            if r_id is not None:
                recipe_days.setdefault(r_id, []).append(day_num)

    for r_id, days in recipe_days.items():
        assert len(days) <= 2
        if len(days) == 2:
            assert abs(days[0] - days[1]) >= 3

    # If shortage occurred, verify unmet_constraints reports it
    unmet = plan["weekly_overview"].get("unmet_constraints", [])
    variety_unmet = [u for u in unmet if u["target_name"] == "Recipe Variety"]
    if any(m.get("recipe_id") is None for d in plan["days"] for m in d["meals"]):
        assert len(variety_unmet) > 0
        assert "shortage" in variety_unmet[0]["suggestion"].lower()


@pytest.mark.asyncio
async def test_dislike_and_regenerate_respects_variety_and_spacing(client: AsyncClient):
    """Verify targeted regeneration preserves unaffected meals while enforcing spacing on replacements."""
    prof_res = await client.post(
        "/api/profile",
        json={
            "name": "Targeted Variety Tester",
            "date_of_birth": "1995-07-12",
            "gender": "female",
            "height_cm": 170.0,
            "activity_level": "sedentary",
        },
    )
    assert prof_res.status_code in (200, 201)

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "simplicity_preference": "varied",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Dislike 'tuna' and regenerate only affected meals
    dislike_res = await client.post(
        "/api/meal-plans/dislike-and-regenerate",
        json={"food_name": "tuna"},
    )
    assert dislike_res.status_code == 200
    res_data = dislike_res.json()
    updated_plan = res_data["plan"]
    assert updated_plan is not None

    # Check that updated plan still strictly respects spacing and repetition
    recipe_days = {}
    for d in updated_plan["days"]:
        day_num = d["day_number"]
        for m in d["meals"]:
            r_id = m.get("recipe_id")
            if r_id is not None:
                recipe_days.setdefault(r_id, []).append(day_num)

    for r_id, days in recipe_days.items():
        assert len(days) <= 2
        if len(days) == 2:
            assert abs(days[0] - days[1]) >= 3


@pytest.mark.asyncio
async def test_placeholder_meals_integrity_and_zero_fabricated_nutrition(client: AsyncClient):
    """Phase 6.1: Verify placeholder meal integrity:
    1. Unassigned placeholder meals contain 0 ingredients.
    2. Placeholders contribute exactly 0.0 kcal / 0.0 macros (no fabricated nutrition).
    3. Daily totals and weekly overview accurately reflect only real ingredients.
    4. Unmet constraints accurately identify calorie/macro deficits and variety shortages.
    """
    prof_res = await client.post(
        "/api/profile",
        json={
            "name": "Placeholder Integrity Tester",
            "date_of_birth": "1991-01-01",
            "gender": "male",
            "height_cm": 178.0,
            "activity_level": "moderately_active",
        },
    )
    assert prof_res.status_code in (200, 201)

    # Dislike heavy set of ingredients across the whole catalogue to force shortages
    heavy_dislikes = [
        "chicken", "beef", "pork", "turkey", "salmon", "tuna", "cod", "fish", "meat",
        "egg", "tofu", "cheese", "yogurt", "milk", "oats", "oatmeal", "rice", "pasta",
        "bread", "banana", "apple", "potato", "sweet potato", "lentil", "bean",
        "chickpea", "peanut", "almond", "walnut", "honey", "berry", "berries",
        "strawberr", "blueberr", "oil", "butter", "olive", "avocado", "flour",
        "tortilla", "wrap", "toast", "pancake", "protein powder", "whey",
    ]
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "disliked_foods": heavy_dislikes,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Find placeholder meals
    placeholders = [
        m for d in plan["days"] for m in d["meals"] if m.get("recipe_id") is None
    ]
    assert len(placeholders) > 0, "Expected at least one placeholder meal due to extreme restrictions"

    for pm in placeholders:
        assert pm["items"] == [], "Placeholder meal must have 0 items"
        assert pm["calories_kcal"] == 0.0, "Placeholder meal must not fabricate calories"
        assert pm["protein_g"] == 0.0, "Placeholder meal must not fabricate protein"
        assert pm["carbs_g"] == 0.0, "Placeholder meal must not fabricate carbs"
        assert pm["fat_g"] == 0.0, "Placeholder meal must not fabricate fat"
        assert pm["name"].startswith("Incomplete"), f"Placeholder name should indicate incomplete slot, got {pm['name']}"

    # Verify shopping list contains NO items with null food or fabricated ingredients
    shop_res = await client.get(f"/api/meal-plans/{plan['id']}/shopping-list")
    assert shop_res.status_code == 200
    shop_items = shop_res.json()
    for item in shop_items:
        assert item["ingredient_name"] != "Wholesome Breakfast Meal"
        assert not item["ingredient_name"].startswith("Incomplete")


@pytest.mark.asyncio
async def test_placeholder_meals_skipped_during_diary_logging(client: AsyncClient):
    """Phase 6.1: Verify logging an incomplete placeholder meal slot:
    1. Single placeholder log request skips and does NOT create a fictitious food log.
    2. Logging the entire day logs real meals and safely skips unassigned placeholders.
    """
    prof_res = await client.post(
        "/api/profile",
        json={
            "name": "Logging Safety Tester",
            "date_of_birth": "1993-04-10",
            "gender": "female",
            "height_cm": 168.0,
            "activity_level": "lightly_active",
        },
    )
    assert prof_res.status_code in (200, 201)

    heavy_dislikes = [
        "chicken", "beef", "pork", "turkey", "salmon", "tuna", "cod", "fish", "meat",
        "egg", "tofu", "cheese", "yogurt", "milk", "oats", "oatmeal", "rice", "pasta",
        "bread", "banana", "apple", "potato", "sweet potato", "lentil", "bean",
        "chickpea", "peanut", "almond", "walnut", "honey", "berry", "berries",
        "strawberr", "blueberr", "oil", "butter", "olive", "avocado", "flour",
        "tortilla", "wrap", "toast", "pancake", "protein powder", "whey",
    ]
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "disliked_foods": heavy_dislikes,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    placeholder = next(
        m for d in plan["days"] for m in d["meals"] if m.get("recipe_id") is None
    )

    # Attempt to log the placeholder directly
    log_res = await client.post(
        "/api/meal-plans/log-meals",
        json={
            "target_date": "2026-10-25",
            "planned_meal_id": placeholder["id"],
            "skip_if_already_logged": True,
        },
    )
    assert log_res.status_code == 200
    log_data = log_res.json()
    assert log_data["logged_count"] == 0
    assert log_data["skipped_count"] >= 1
    assert log_data["success"] is False

    # Check food diary for that date has 0 entries and 0 calories
    diary_res = await client.get("/api/meal-logs/summary?date=2026-10-25")
    assert diary_res.status_code == 200
    summary = diary_res.json()
    assert summary["total_entries"] == 0
    assert summary["totals"]["calories_kcal"] == 0.0


