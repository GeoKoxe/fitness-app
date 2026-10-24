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
async def test_weekly_and_daily_nutrition_adherence_within_tolerance(client: AsyncClient):
    """Verify that weekly average and daily totals for calories and macros fall within tolerance.
    
    Target: 2000 kcal, 130g protein, 225g carbs, 65g fat (10% tolerance).
    """
    await client.post(
        "/api/profile",
        json={
            "name": "Alex Optimizer",
            "date_of_birth": "1995-03-10",
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
            "name": "2000 kcal Optimized Plan",
            "target_calories": 2000,
            "target_protein": 130,
            "target_carbs": 225,
            "target_fat": 65,
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

    # Weekly average adherence within 10%
    assert abs(avg_cal - 2000.0) / 2000.0 <= 0.10, f"Avg Cal {avg_cal} exceeds 10% tolerance from 2000"
    assert abs(avg_p - 130.0) / 130.0 <= 0.10, f"Avg Protein {avg_p} exceeds 10% tolerance from 130g"
    assert abs(avg_c - 225.0) / 225.0 <= 0.10, f"Avg Carbs {avg_c} exceeds 10% tolerance from 225g"
    assert abs(avg_f - 65.0) / 65.0 <= 0.10, f"Avg Fat {avg_f} exceeds 10% tolerance from 65g"

    # Daily balance: each complete day must also fall within 10% tolerance of target calories
    for day in plan["days"]:
        day_cal = day["total_calories"]
        day_dev = abs(day_cal - 2000.0) / 2000.0
        assert day_dev <= 0.10, f"Day {day['day_number']} calories ({day_cal}) deviated by {day_dev*100:.1f}% (> 10%)"


@pytest.mark.asyncio
async def test_higher_calorie_target_adherence(client: AsyncClient):
    """Verify that a higher calorie target (2500 kcal) achieves nutritional adherence."""
    await client.post(
        "/api/profile",
        json={
            "name": "Jordan Athlete",
            "date_of_birth": "1992-07-22",
            "gender": "male",
            "height_cm": 185.0,
            "activity_level": "very_active",
        },
    )
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "2500 kcal Athlete Plan",
            "target_calories": 2500,
            "target_protein": 160,
            "target_carbs": 280,
            "target_fat": 80,
            "target_tolerance_pct": 10.0,
            "simplicity_preference": "varied",
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    overview = plan["weekly_overview"]
    avg_cal = overview["average_daily_calories"]
    avg_p = overview["average_daily_protein"]

    assert abs(avg_cal - 2500.0) / 2500.0 <= 0.10, f"Avg Cal {avg_cal} exceeds 10% tolerance from 2500"
    assert abs(avg_p - 160.0) / 160.0 <= 0.10, f"Avg Protein {avg_p} exceeds 10% tolerance from 160g"


@pytest.mark.asyncio
async def test_incompatible_targets_flagged_with_conflict_warning(client: AsyncClient):
    """Verify that mathematically incompatible targets produce an explicit conflict warning in unmet_constraints
    without silently mutating or overriding the user's targets.
    """
    await client.post(
        "/api/profile",
        json={
            "name": "Taylor Conflicted",
            "date_of_birth": "1990-01-01",
            "gender": "female",
            "height_cm": 165.0,
            "activity_level": "sedentary",
        },
    )

    # 1500 kcal vs macros providing ~2500 kcal (4*200 + 4*200 + 9*100 = 2500 kcal)
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Conflicted Target Plan",
            "target_calories": 1500,
            "target_protein": 200,
            "target_carbs": 200,
            "target_fat": 100,
            "target_tolerance_pct": 10.0,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    overview = plan["weekly_overview"]
    unmet = overview.get("unmet_constraints", [])

    # Check that a conflict warning is present
    conflict_constraints = [c for c in unmet if c.get("status") == "conflict" or "Compatibility" in c.get("target_name", "")]
    assert len(conflict_constraints) > 0, "Expected a Target Compatibility conflict warning in unmet_constraints"

    compat_warning = conflict_constraints[0]
    assert compat_warning["target_name"] == "Target Compatibility"
    assert compat_warning["status"] == "conflict"
    assert "2500 kcal" in compat_warning["suggestion"]
    assert "1500 kcal" in compat_warning["suggestion"]

    # Assert user targets were NOT silently modified
    assert overview["target_calories"] == 1500.0
    assert overview["target_protein"] == 200.0
    assert overview["target_carbs"] == 200.0
    assert overview["target_fat"] == 100.0


@pytest.mark.asyncio
async def test_repetition_and_spacing_strictly_preserved(client: AsyncClient):
    """Verify that repetition (max 2) and calendar spacing (>= 3 days) rules remain strictly enforced."""
    await client.post(
        "/api/profile",
        json={
            "name": "Robin Rules",
            "date_of_birth": "1996-11-12",
            "gender": "male",
            "height_cm": 180.0,
            "activity_level": "moderately_active",
        },
    )
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Spacing Test Plan",
            "target_calories": 2100,
            "target_protein": 135,
            "target_carbs": 235,
            "target_fat": 68,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    assignments = {}
    for day in plan["days"]:
        day_num = day["day_number"]
        for meal in day["meals"]:
            rid = meal.get("recipe_id")
            if rid:
                assignments.setdefault(rid, []).append(day_num)

    for rid, days in assignments.items():
        assert len(days) <= 2, f"Recipe {rid} appeared {len(days)} times (>2)!"
        if len(days) == 2:
            spacing = abs(days[0] - days[1])
            assert spacing >= 3, f"Recipe {rid} repeated with spacing {spacing} on days {days} (<3)!"

    # Variety should be high across 28 slots
    unique_count = len(assignments.keys())
    assert unique_count >= 20, f"Expected at least 20 unique recipes, got {unique_count}"


@pytest.mark.asyncio
async def test_portion_realism_and_multiples_of_five(client: AsyncClient):
    """Verify portion multiplier realism:
    - Servings must be whole integers (1.0 or 2.0, never 1.5).
    - Ingredient gram/ml amounts must be multiples of 5, counts must be whole integers.
    """
    await client.post(
        "/api/profile",
        json={
            "name": "Sam Portion",
            "date_of_birth": "1993-04-05",
            "gender": "female",
            "height_cm": 170.0,
            "activity_level": "moderately_active",
        },
    )
    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Portion Rules Plan",
            "target_calories": 2300,
            "target_protein": 145,
            "target_carbs": 255,
            "target_fat": 75,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    for day in plan["days"]:
        for meal in day["meals"]:
            serv = meal["servings"]
            # Must be whole servings (1.0 or 2.0), no 1.5
            assert serv in (1.0, 2.0), f"Meal servings multiplier was {serv}, expected 1.0 or 2.0"

            for item in meal.get("items", []):
                qty = item["quantity"]
                unit = item["unit"].lower()
                if unit in ("g", "ml"):
                    assert round(qty) % 5 == 0, f"Item {item.get('food_name')} qty {qty} {unit} is not a multiple of 5"
                elif unit in ("count", "whole", "egg", "slice", "clove", "tbsp", "tsp"):
                    assert qty == round(qty), f"Item {item.get('food_name')} qty {qty} {unit} is not a whole integer"


@pytest.mark.asyncio
async def test_deterministic_reproducibility(client: AsyncClient):
    """Verify that generating two plans with identical inputs yields identical recipe assignments."""
    await client.post(
        "/api/profile",
        json={
            "name": "Casey Deterministic",
            "date_of_birth": "1991-08-14",
            "gender": "male",
            "height_cm": 182.0,
            "activity_level": "moderately_active",
        },
    )
    req_body = {
        "name": "Deterministic Run 1",
        "target_calories": 2150,
        "target_protein": 135,
        "target_carbs": 240,
        "target_fat": 70,
        "simplicity_preference": "simple",
    }
    res1 = await client.post("/api/meal-plans/generate", json=req_body)
    assert res1.status_code == 201
    plan1 = res1.json()

    req_body["name"] = "Deterministic Run 2"
    res2 = await client.post("/api/meal-plans/generate", json=req_body)
    assert res2.status_code == 201
    plan2 = res2.json()

    # Compare recipe IDs day by day and slot by slot
    for d1, d2 in zip(plan1["days"], plan2["days"]):
        for m1, m2 in zip(d1["meals"], d2["meals"]):
            assert m1["recipe_id"] == m2["recipe_id"], f"Non-deterministic assignment on Day {d1['day_number']} {m1['meal_category']}: {m1['recipe_id']} != {m2['recipe_id']}"
            assert m1["servings"] == m2["servings"]
            assert m1["calories_kcal"] == m2["calories_kcal"]

