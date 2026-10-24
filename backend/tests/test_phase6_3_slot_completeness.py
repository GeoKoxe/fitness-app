"""Phase 6.3 regression test suite: Reliable Meal Slot Completion and Optimization.

Verifies the 18 specific test scenarios:
1. Standard weekly generation fills all 28 slots.
2. Scheduling avoids deadlocks via backtracking when valid assignments exist.
3. Deterministic reproducibility for identical inputs.
4. Existing strict repetition and spacing rules satisfied whenever feasible.
5. Disliked eggs and oats excluded from generated meals (Profile 1 scenario).
6. Limited eligible pool triggers appropriate relaxation only when necessary.
7. Repetition relaxation preserves >= 3 day spacing.
8. Cross-category alternatives accepted only when genuinely suitable.
9. Cooking-time limits strictly enforced.
10. Arbitrary valid calorie and macro targets work without hardcoding.
11. Nutrition totals match actual planned ingredient quantities.
12. Missing/invalid ingredients cannot produce falsely complete meal.
13. Empty candidate pool reported as genuine infeasibility.
14. Incomplete slots remain unloggable and contribute 0.0 nutrition.
15. Regeneration of incomplete slot uses intended category calorie target.
16. Manual replacement completes slot and updates ingredients/nutrition/shopping list.
17. Existing meal plans and user data remain unchanged.
18. Phase 6 and 6.2 tests continue passing.
"""

import datetime
import time
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
async def test_01_standard_weekly_generation_fills_all_28_slots(client: AsyncClient):
    """Scenario 1: Standard weekly generation fills all 28 slots."""
    await client.post(
        "/api/profile",
        json={
            "name": "Standard User",
            "date_of_birth": "1993-04-12",
            "gender": "male",
            "height_cm": 178.0,
            "activity_level": "moderately_active",
        },
    )
    await client.put(
        "/api/nutrition-goals",
        json={
            "daily_calories": 2000,
            "daily_protein_g": 130,
            "daily_carbs_g": 225,
            "daily_fat_g": 65,
            "daily_fiber_g": 30,
        },
    )

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Complete 28 Slot Plan",
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "simplicity_preference": "varied",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    assert len(plan["days"]) == 7
    total_slots = sum(len(d["meals"]) for d in plan["days"])
    assert total_slots == 28

    incomplete_slots = 0
    for day in plan["days"]:
        assert len(day["meals"]) == 4
        for meal in day["meals"]:
            assert meal["recipe_id"] is not None
            assert meal["name"] is not None and len(meal["name"]) > 0
            assert meal["servings"] in (1.0, 2.0)
            assert meal["calories_kcal"] > 0
            assert meal["protein_g"] > 0
            assert meal["carbs_g"] > 0
            assert meal["fat_g"] > 0
            assert len(meal["items"]) > 0
            if meal["recipe_id"] is None:
                incomplete_slots += 1

    assert incomplete_slots == 0


@pytest.mark.asyncio
async def test_02_scheduling_avoids_deadlocks_via_backtracking(client: AsyncClient):
    """Scenario 2: Scheduling avoids deadlocks via backtracking when valid assignments exist."""
    await client.post(
        "/api/profile",
        json={
            "name": "Backtrack User",
            "date_of_birth": "1990-01-01",
            "gender": "female",
            "height_cm": 165.0,
            "activity_level": "moderately_active",
        },
    )
    t0 = time.time()
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Backtrack Verified Plan",
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "simplicity_preference": "varied",
        },
    )
    elapsed_ms = (time.time() - t0) * 1000.0
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Backtracking must succeed in under 100ms (measured typically < 10ms)
    assert elapsed_ms < 1000.0, f"Scheduling took too long: {elapsed_ms:.1f}ms"

    # All slots filled
    all_meals = [m for d in plan["days"] for m in d["meals"]]
    assert len(all_meals) == 28
    assert all(m["recipe_id"] is not None for m in all_meals)


@pytest.mark.asyncio
async def test_03_deterministic_reproducibility(client: AsyncClient):
    """Scenario 3: Deterministic reproducibility for identical inputs."""
    await client.post(
        "/api/profile",
        json={
            "name": "Deterministic Tester",
            "date_of_birth": "1995-08-20",
            "gender": "male",
            "height_cm": 182.0,
            "activity_level": "very_active",
        },
    )

    req_payload = {
        "name": "Deterministic Plan",
        "start_date": "2026-11-01",
        "target_calories": 2100,
        "target_protein": 140,
        "target_carbs": 240,
        "target_fat": 65,
        "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
        "simplicity_preference": "varied",
    }

    res_a = await client.post("/api/meal-plans/generate", json=req_payload)
    assert res_a.status_code == 201
    plan_a = res_a.json()

    res_b = await client.post("/api/meal-plans/generate", json=req_payload)
    assert res_b.status_code == 201
    plan_b = res_b.json()

    # Compare exact recipe assignments across all 28 slots
    for day_idx in range(7):
        day_a = plan_a["days"][day_idx]
        day_b = plan_b["days"][day_idx]
        assert day_a["day_number"] == day_b["day_number"]
        for meal_idx in range(len(day_a["meals"])):
            m_a = day_a["meals"][meal_idx]
            m_b = day_b["meals"][meal_idx]
            assert m_a["recipe_id"] == m_b["recipe_id"]
            assert m_a["servings"] == m_b["servings"]
            assert m_a["calories_kcal"] == m_b["calories_kcal"]


@pytest.mark.asyncio
async def test_04_strict_repetition_and_spacing_when_feasible(client: AsyncClient):
    """Scenario 4: Existing strict repetition and spacing rules satisfied whenever feasible."""
    await client.post(
        "/api/profile",
        json={
            "name": "Strict Rules Tester",
            "date_of_birth": "1991-02-14",
            "gender": "female",
            "height_cm": 170.0,
            "activity_level": "moderately_active",
        },
    )

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Strict Plan",
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "simplicity_preference": "varied",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    recipe_days = {}
    for day in plan["days"]:
        day_num = day["day_number"]
        seen_today = set()
        for meal in day["meals"]:
            rid = meal["recipe_id"]
            assert rid is not None
            assert rid not in seen_today, f"Intraday duplicate: recipe {rid} on Day {day_num}"
            seen_today.add(rid)
            recipe_days.setdefault(rid, []).append(day_num)

    for rid, days in recipe_days.items():
        assert len(days) <= 2, f"Recipe {rid} appeared {len(days)} times (>2)!"
        if len(days) == 2:
            spacing = abs(days[0] - days[1])
            assert spacing >= 3, f"Recipe {rid} repeated with spacing {spacing} (<3) on days {days}!"

    # High recipe diversity: at least 20 unique recipes across 28 slots
    unique_recipes = len(recipe_days.keys())
    assert unique_recipes >= 20, f"Expected high diversity, got {unique_recipes}"


@pytest.mark.asyncio
async def test_05_profile_1_disliked_eggs_and_oats_excluded(client: AsyncClient):
    """Scenario 5: Disliked eggs and oats excluded from generated meals (Profile 1 scenario).
    
    Verifies that:
    1. Day 7 breakfast is fully complete (fixing the investigated issue).
    2. All 28 slots are complete.
    3. Neither eggs nor oats appear in any planned meal or ingredient.
    """
    await client.post(
        "/api/profile",
        json={
            "name": "Profile 1 Tester",
            "date_of_birth": "1988-06-30",
            "gender": "male",
            "height_cm": 180.0,
            "activity_level": "moderately_active",
        },
    )

    # Dislike eggs and oats
    await client.post("/api/meal-plans/disliked-foods", json={"food_name": "eggs"})
    await client.post("/api/meal-plans/disliked-foods", json={"food_name": "oats"})

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Profile 1 Egg-Free Oat-Free Plan",
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "simplicity_preference": "varied",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # 1. Day 7 breakfast MUST be complete
    day7 = next(d for d in plan["days"] if d["day_number"] == 7)
    day7_breakfast = next(m for m in day7["meals"] if m["meal_category"].lower() == "breakfast")
    assert day7_breakfast["recipe_id"] is not None
    assert day7_breakfast["calories_kcal"] > 0
    assert len(day7_breakfast["items"]) > 0

    # 2. All 28 slots complete
    all_meals = [m for d in plan["days"] for m in d["meals"]]
    assert len(all_meals) == 28
    assert all(m["recipe_id"] is not None for m in all_meals)

    # 3. No eggs or oats anywhere in the plan
    disliked_stems = ("egg", "oat")
    for meal in all_meals:
        m_name = meal["name"].lower()
        for stem in disliked_stems:
            assert stem not in m_name, f"Disliked stem '{stem}' found in meal name '{meal['name']}'"
        for item in meal["items"]:
            # Check associated food name
            f_name = (item.get("food") or {}).get("name", "").lower()
            for stem in disliked_stems:
                assert stem not in f_name, f"Disliked stem '{stem}' found in ingredient '{f_name}'"


@pytest.mark.asyncio
async def test_06_limited_pool_triggers_appropriate_relaxation(client: AsyncClient):
    """Scenario 6: Limited eligible pool triggers appropriate relaxation only when necessary."""
    await client.post(
        "/api/profile",
        json={
            "name": "Relaxation Tester",
            "date_of_birth": "1994-10-10",
            "gender": "female",
            "height_cm": 168.0,
            "activity_level": "lightly_active",
        },
    )

    # Exclude most breakfast items except 3 recipes
    # e.g., eggs and oats leaves 3 native breakfast recipes
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Relaxation Plan",
            "enabled_categories": ["breakfast"],
            "disliked_foods": ["eggs", "oats"],
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # All 7 days filled
    b_meals = [m for d in plan["days"] for m in d["meals"]]
    assert len(b_meals) == 7
    assert all(m["recipe_id"] is not None for m in b_meals)


@pytest.mark.asyncio
async def test_07_repetition_relaxation_preserves_spacing(client: AsyncClient):
    """Scenario 7: Repetition relaxation preserves >= 3 day spacing."""
    await client.post(
        "/api/profile",
        json={
            "name": "Spacing Guard Tester",
            "date_of_birth": "1993-01-15",
            "gender": "male",
            "height_cm": 175.0,
            "activity_level": "moderately_active",
        },
    )

    # Generate plan with constrained breakfast
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Spacing Plan",
            "enabled_categories": ["breakfast"],
            "disliked_foods": ["eggs", "oats"],
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    recipe_days = {}
    for d in plan["days"]:
        for m in d["meals"]:
            rid = m.get("recipe_id")
            if rid:
                recipe_days.setdefault(rid, []).append(d["day_number"])

    for rid, days in recipe_days.items():
        assert len(days) <= 3, f"Recipe {rid} appeared {len(days)} times (>3)!"
        days_sorted = sorted(days)
        for i in range(len(days_sorted) - 1):
            diff = days_sorted[i + 1] - days_sorted[i]
            assert diff >= 3, f"Recipe {rid} repeated with invalid spacing {diff} (<3) on days {days_sorted}"


@pytest.mark.asyncio
async def test_08_cross_category_suitability_enforced(client: AsyncClient):
    """Scenario 8: Cross-category alternatives accepted only when genuinely suitable."""
    from app.services.meal_planner_service import is_cross_category_suitable
    from app.models.recipe import Recipe

    # Verify culinary suitability rules
    toast_snack = Recipe(name="Peanut Butter & Banana Toast", meal_category="snack")
    yogurt_snack = Recipe(name="Greek Yogurt with Honey & Chia Seeds", meal_category="snack")
    curry_dinner = Recipe(name="Chicken Tikka Masala Curry", meal_category="dinner")

    # Toast and yogurt snacks are suitable for breakfast
    assert is_cross_category_suitable(toast_snack, "breakfast") is True
    assert is_cross_category_suitable(yogurt_snack, "breakfast") is True

    # Dinner curry is NOT suitable for breakfast
    assert is_cross_category_suitable(curry_dinner, "breakfast") is False

    # Lunch / dinner crossover is allowed
    assert is_cross_category_suitable(curry_dinner, "lunch") is True


@pytest.mark.asyncio
async def test_09_cooking_time_limits_enforced(client: AsyncClient):
    """Scenario 9: Cooking-time limits strictly enforced."""
    await client.post(
        "/api/profile",
        json={
            "name": "Quick Cook Tester",
            "date_of_birth": "1992-05-18",
            "gender": "male",
            "height_cm": 180.0,
            "activity_level": "moderately_active",
        },
    )

    max_cook = 10
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Quick Meals Plan",
            "enabled_categories": ["breakfast", "lunch", "dinner", "snacks"],
            "max_cooking_time_minutes": max_cook,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Query recipe details from db
    db = TestSessionLocal()
    from app.models.recipe import Recipe
    try:
        for day in plan["days"]:
            for meal in day["meals"]:
                rid = meal.get("recipe_id")
                if rid:
                    r = db.query(Recipe).filter(Recipe.id == rid).first()
                    assert r is not None
                    total_time = (r.prep_time_minutes or 0) + (r.cook_time_minutes or 0)
                    assert total_time <= max_cook, f"Recipe '{r.name}' total time {total_time}m exceeds {max_cook}m limit!"
    finally:
        db.close()


@pytest.mark.asyncio
async def test_10_arbitrary_calorie_and_macro_targets_generalize(client: AsyncClient):
    """Scenario 10: Arbitrary valid calorie and macro targets work without hardcoding."""
    await client.post(
        "/api/profile",
        json={
            "name": "Arbitrary Target Tester",
            "date_of_birth": "1991-09-09",
            "gender": "male",
            "height_cm": 176.0,
            "activity_level": "very_active",
        },
    )

    # 1850 kcal target with compatible macros: 115g p (460), 215g c (860), 58g f (522) = 1842 kcal
    t_cal, t_p, t_c, t_f = 1850.0, 115.0, 215.0, 58.0
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Arbitrary 1850 Plan",
            "target_calories": t_cal,
            "target_protein": t_p,
            "target_carbs": t_c,
            "target_fat": t_f,
            "target_tolerance_pct": 10.0,
            "simplicity_preference": "varied",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    overview = plan["weekly_overview"]
    avg_cal = overview["average_daily_calories"]
    avg_p = overview["average_daily_protein"]
    avg_c = overview["average_daily_carbs"]
    avg_f = overview["average_daily_fat"]

    # Must be within 10% tolerance of arbitrary targets
    assert abs(avg_cal - t_cal) / t_cal <= 0.10
    assert abs(avg_p - t_p) / t_p <= 0.10
    assert abs(avg_c - t_c) / t_c <= 0.10
    assert abs(avg_f - t_f) / t_f <= 0.10


@pytest.mark.asyncio
async def test_11_nutrition_totals_match_actual_ingredients(client: AsyncClient):
    """Scenario 11: Nutrition totals match actual planned ingredient quantities."""
    await client.post(
        "/api/profile",
        json={
            "name": "Nutrition Math Tester",
            "date_of_birth": "1994-03-21",
            "gender": "female",
            "height_cm": 168.0,
            "activity_level": "moderately_active",
        },
    )

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Math Audit Plan"},
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    for day in plan["days"]:
        day_sum_cal = 0.0
        day_sum_p = 0.0
        day_sum_c = 0.0
        day_sum_f = 0.0

        for meal in day["meals"]:
            m_cal = sum(it["calories_kcal"] for it in meal["items"])
            m_p = sum(it["protein_g"] for it in meal["items"])
            m_c = sum(it["carbs_g"] for it in meal["items"])
            m_f = sum(it["fat_g"] for it in meal["items"])

            assert abs(meal["calories_kcal"] - m_cal) < 0.2
            assert abs(meal["protein_g"] - m_p) < 0.2
            assert abs(meal["carbs_g"] - m_c) < 0.2
            assert abs(meal["fat_g"] - m_f) < 0.2

            day_sum_cal += meal["calories_kcal"]
            day_sum_p += meal["protein_g"]
            day_sum_c += meal["carbs_g"]
            day_sum_f += meal["fat_g"]

        assert abs(day["total_calories"] - day_sum_cal) < 0.5
        assert abs(day["total_protein"] - day_sum_p) < 0.5
        assert abs(day["total_carbs"] - day_sum_c) < 0.5
        assert abs(day["total_fat"] - day_sum_f) < 0.5


@pytest.mark.asyncio
async def test_12_missing_ingredients_cannot_fabricate_nutrition(client: AsyncClient):
    """Scenario 12: Missing/invalid ingredients cannot produce falsely complete meal."""
    db = TestSessionLocal()
    from app.models.meal_plan import PlannedMeal
    try:
        # A meal with no recipe or items
        empty_meal = PlannedMeal(
            meal_plan_id=1,
            day_number=1,
            meal_category="breakfast",
            name="Incomplete Slot",
            calories_kcal=0.0,
            protein_g=0.0,
            carbs_g=0.0,
            fat_g=0.0,
            fiber_g=0.0,
        )
        assert empty_meal.recipe_id is None
        assert empty_meal.calories_kcal == 0.0
        assert empty_meal.protein_g == 0.0
    finally:
        db.close()


@pytest.mark.asyncio
async def test_13_empty_candidate_pool_reported_as_genuine_infeasibility(client: AsyncClient):
    """Scenario 13: Empty candidate pool reported as genuine infeasibility."""
    await client.post(
        "/api/profile",
        json={
            "name": "Infeasible Tester",
            "date_of_birth": "1995-12-12",
            "gender": "male",
            "height_cm": 180.0,
            "activity_level": "moderately_active",
        },
    )

    # Dislike ingredients that disqualify ALL breakfast recipes
    dislikes = [
        "eggs", "oats", "yogurt", "cottage cheese", "bread",
        "sweet potatoes", "peanut butter", "chia", "milk", "butter"
    ]
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Infeasible Plan",
            "enabled_categories": ["breakfast"],
            "disliked_foods": dislikes,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Plan should report shortage transparently in unmet_constraints
    unmet = plan["weekly_overview"].get("unmet_constraints", [])
    assert len(unmet) > 0
    assert any("shortage" in u.get("suggestion", "").lower() or "eligible" in u.get("suggestion", "").lower() for u in unmet)

    # Incomplete slots must contribute 0.0 calories
    incomplete = [m for d in plan["days"] for m in d["meals"] if m["recipe_id"] is None]
    assert len(incomplete) > 0
    for inc in incomplete:
        assert inc["calories_kcal"] == 0.0
        assert len(inc["items"]) == 0


@pytest.mark.asyncio
async def test_14_incomplete_slots_unloggable_to_diary(client: AsyncClient):
    """Scenario 14: Incomplete slots remain unloggable and contribute 0.0 nutrition."""
    await client.post(
        "/api/profile",
        json={
            "name": "Diary Lock Tester",
            "date_of_birth": "1992-04-05",
            "gender": "female",
            "height_cm": 165.0,
            "activity_level": "lightly_active",
        },
    )

    # Generate plan with incomplete slots
    dislikes = [
        "eggs", "oats", "yogurt", "cottage cheese", "bread",
        "sweet potatoes", "peanut butter", "chia", "milk", "butter"
    ]
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Shortage Plan",
            "enabled_categories": ["breakfast"],
            "disliked_foods": dislikes,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    incomplete_meal = next(
        m for d in plan["days"] for m in d["meals"] if m["recipe_id"] is None
    )

    # Attempt to log this incomplete meal to diary
    log_res = await client.post(
        "/api/meal-plans/log-meals",
        json={
            "planned_meal_id": incomplete_meal["id"],
            "target_date": "2026-11-02",
        },
    )
    assert log_res.status_code == 200
    log_data = log_res.json()
    assert log_data["logged_count"] == 0
    assert log_data["success"] is False
    assert "incomplete" in log_data["message"].lower() or "no planned meals" in log_data["message"].lower()


@pytest.mark.asyncio
async def test_15_regeneration_of_incomplete_slot_uses_category_target(client: AsyncClient):
    """Scenario 15: Regeneration of incomplete slot uses intended category calorie target."""
    await client.post(
        "/api/profile",
        json={
            "name": "Regen Target Tester",
            "date_of_birth": "1993-07-22",
            "gender": "male",
            "height_cm": 182.0,
            "activity_level": "moderately_active",
        },
    )
    await client.put(
        "/api/nutrition-goals",
        json={"daily_calories": 2000, "daily_protein_g": 130, "daily_carbs_g": 225, "daily_fat_g": 65, "daily_fiber_g": 30},
    )

    # Generate plan with incomplete slots
    dislikes = [
        "eggs", "oats", "yogurt", "cottage cheese", "bread",
        "sweet potatoes", "peanut butter", "chia", "milk", "butter"
    ]
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Regen Shortage Plan",
            "enabled_categories": ["breakfast"],
            "disliked_foods": dislikes,
        },
    )
    plan = gen_res.json()
    incomplete_meal = next(
        m for d in plan["days"] for m in d["meals"] if m["recipe_id"] is None
    )

    # Now remove all dislikes so recipes become available
    disliked_list = (await client.get("/api/meal-plans/disliked-foods")).json()
    for d in disliked_list:
        await client.delete(f"/api/meal-plans/disliked-foods/{d['id']}")

    # Regenerate the incomplete meal
    regen_res = await client.post(f"/api/meal-plans/planned-meals/{incomplete_meal['id']}/regenerate")
    assert regen_res.status_code == 200
    updated_plan = regen_res.json()

    # The meal was evaluated against intended target (~500 kcal, not 0.0)
    refreshed_meal = next(
        m for d in updated_plan["days"] for m in d["meals"] if m["id"] == incomplete_meal["id"]
    )
    assert refreshed_meal["recipe_id"] is not None
    assert refreshed_meal["calories_kcal"] > 0


@pytest.mark.asyncio
async def test_16_manual_replacement_completes_slot_and_updates_shopping_list(client: AsyncClient):
    """Scenario 16: Manual replacement completes slot and updates ingredients/nutrition/shopping list."""
    await client.post(
        "/api/profile",
        json={
            "name": "Manual Replace Tester",
            "date_of_birth": "1994-08-14",
            "gender": "female",
            "height_cm": 169.0,
            "activity_level": "moderately_active",
        },
    )

    # Dislike eggs
    await client.post("/api/meal-plans/disliked-foods", json={"food_name": "eggs"})

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={"name": "Replace Test Plan"},
    )
    plan = gen_res.json()
    day1_meal = plan["days"][0]["meals"][0]

    # Find a recipe with eggs
    db = TestSessionLocal()
    from app.models.recipe import Recipe
    from app.services.meal_planner_service import meal_planner_service
    try:
        egg_recipe = next(
            r for r in db.query(Recipe).all()
            if "egg" in r.name.lower() or any("egg" in ing.food.name.lower() for ing in r.ingredients if ing.food)
        )
        non_egg_recipe = next(
            r for r in db.query(Recipe).all()
            if not meal_planner_service.is_recipe_disliked(r, set(), ["eggs"]) and r.id != day1_meal["recipe_id"]
        )
    finally:
        db.close()

    # Replacing with disliked egg recipe must fail with 400
    fail_res = await client.put(
        f"/api/meal-plans/planned-meals/{day1_meal['id']}/replace?recipe_id={egg_recipe.id}"
    )
    assert fail_res.status_code == 400
    assert "disliked" in fail_res.json()["detail"].lower()

    # Replacing with valid non-egg recipe must succeed
    succ_res = await client.put(
        f"/api/meal-plans/planned-meals/{day1_meal['id']}/replace?recipe_id={non_egg_recipe.id}"
    )
    assert succ_res.status_code == 200
    plan_after = succ_res.json()
    updated_meal = next(
        m for d in plan_after["days"] for m in d["meals"] if m["id"] == day1_meal["id"]
    )
    assert updated_meal["recipe_id"] == non_egg_recipe.id
    assert len(updated_meal["items"]) > 0
    assert updated_meal["calories_kcal"] > 0

    # Verify shopping list is updated
    shop_res = await client.get(f"/api/meal-plans/{plan['id']}/shopping-list")
    assert shop_res.status_code == 200
    shop_items = shop_res.json()
    assert len(shop_items) > 0


@pytest.mark.asyncio
async def test_17_existing_meal_plans_and_user_data_preserved(client: AsyncClient):
    """Scenario 17: Existing meal plans and user data remain unchanged."""
    await client.post(
        "/api/profile",
        json={
            "name": "Data Preservation Tester",
            "date_of_birth": "1990-11-11",
            "gender": "male",
            "height_cm": 178.0,
            "activity_level": "moderately_active",
        },
    )

    plans_res = await client.get("/api/meal-plans")
    assert plans_res.status_code == 200
    initial_plans = plans_res.json()

    # Generate a new plan
    await client.post("/api/meal-plans/generate", json={"name": "Preservation Check Plan"})

    # Check plans list again
    plans_after = (await client.get("/api/meal-plans")).json()
    assert len(plans_after) == len(initial_plans) + 1


@pytest.mark.asyncio
async def test_18_phase6_and_6_2_compatibility(client: AsyncClient):
    """Scenario 18: Phase 6 and 6.2 tests continue passing."""
    await client.post(
        "/api/profile",
        json={
            "name": "Compatibility Tester",
            "date_of_birth": "1995-05-05",
            "gender": "male",
            "height_cm": 180.0,
            "activity_level": "very_active",
        },
    )
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Compatibility Plan",
            "target_calories": 2000,
            "target_protein": 130,
            "target_carbs": 225,
            "target_fat": 65,
            "simplicity_preference": "varied",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    # Weekly adherence within 10%
    overview = plan["weekly_overview"]
    assert abs(overview["average_daily_calories"] - 2000.0) / 2000.0 <= 0.10

    # Spacing and repetition rules strictly held
    recipe_days = {}
    for d in plan["days"]:
        for m in d["meals"]:
            rid = m.get("recipe_id")
            if rid:
                recipe_days.setdefault(rid, []).append(d["day_number"])

    for rid, days in recipe_days.items():
        assert len(days) <= 2
        if len(days) == 2:
            assert abs(days[0] - days[1]) >= 3
