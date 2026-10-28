import pytest
from httpx import AsyncClient

from app.db.seed_generic_foods import seed_generic_foods
from app.db.seed_recipes import seed_built_in_recipes
from app.services.meal_planner_service import normalize_unit_and_value, meal_planner_service
from tests.conftest import TestSessionLocal


@pytest.fixture(autouse=True)
def seed_test_data():
    db = TestSessionLocal()
    try:
        seed_generic_foods(db)
        seed_built_in_recipes(db)
    finally:
        db.close()


def test_unit_normalization_conversions():
    """Verify mass (g <-> kg) and volume (ml <-> l) conversions and preservation of non-convertible units."""
    # Mass conversions
    fam, val, unit = normalize_unit_and_value(1500.0, "g")
    assert fam == "mass"
    assert val == 1500.0
    assert unit == "g"

    fam, val, unit = normalize_unit_and_value(0.5, "kg")
    assert fam == "mass"
    assert val == 500.0
    assert unit == "g"

    fam, val, unit = normalize_unit_and_value(250.0, "grams")
    assert fam == "mass"
    assert val == 250.0
    assert unit == "g"

    # Volume conversions
    fam, val, unit = normalize_unit_and_value(2.5, "l")
    assert fam == "volume"
    assert val == 2500.0
    assert unit == "ml"

    fam, val, unit = normalize_unit_and_value(350.0, "ml")
    assert fam == "volume"
    assert val == 350.0
    assert unit == "ml"

    fam, val, unit = normalize_unit_and_value(1.75, "liters")
    assert fam == "volume"
    assert val == 1750.0
    assert unit == "ml"

    # Distinct / non-convertible units preserved as-is
    fam, val, unit = normalize_unit_and_value(4.0, "slices")
    assert fam == "slices"
    assert val == 4.0
    assert unit == "slices"

    fam, val, unit = normalize_unit_and_value(2.0, "tbsp")
    assert fam == "tbsp"
    assert val == 2.0
    assert unit == "tbsp"


@pytest.mark.asyncio
async def test_generate_goals_endpoint_atwater_and_explicit_application(client: AsyncClient):
    """Verify GET /api/nutrition/goals/generate computes 3 reconciled profiles and leaves manual goals unchanged until applied."""
    # Set up user profile
    await client.post(
        "/api/profile",
        json={
            "name": "Jordan Taylor",
            "date_of_birth": "1994-06-15",
            "sex": "male",
            "height_cm": 182.0,
            "activity_level": "moderately_active",
        },
    )
    await client.post(
        "/api/measurements",
        json={"weight_kg": 80.0, "measured_at": "2026-10-28T08:00:00Z"},
    )

    # Establish manual goals
    init_goals_res = await client.put(
        "/api/nutrition/goals",
        json={
            "calories_kcal": 2200.0,
            "protein_g": 140.0,
            "carbohydrates_g": 250.0,
            "fat_g": 70.0,
        },
    )
    assert init_goals_res.status_code == 200

    # Call Generate Goals
    gen_goals_res = await client.get("/api/nutrition/goals/generate")
    assert gen_goals_res.status_code == 200
    gen_data = gen_goals_res.json()

    assert "bmr_kcal" in gen_data
    assert "tdee_kcal" in gen_data
    assert "profiles" in gen_data
    assert len(gen_data["profiles"]) == 3

    keys = [p["key"] for p in gen_data["profiles"]]
    assert "weight_loss" in keys
    assert "bulking" in keys
    assert "sustainability" in keys

    # Verify Atwater reconciliation for all profiles
    for profile in gen_data["profiles"]:
        c = profile["calories_kcal"]
        p = profile["protein_g"]
        carb = profile["carbs_g"]
        f = profile["fat_g"]
        atwater_sum = 4 * p + 4 * carb + 9 * f
        assert abs(c - atwater_sum) <= 1.0, f"Profile {profile['name']} violates Atwater reconciliation: {c} vs {atwater_sum}"

    # Verify current active goals are strictly unchanged
    curr_goals_res = await client.get("/api/nutrition/goals")
    assert curr_goals_res.status_code == 200
    curr_goals = curr_goals_res.json()
    assert curr_goals["calories_kcal"] == 2200.0
    assert curr_goals["protein_g"] == 140.0

    # Explicit application of the sustainability profile
    sust_profile = next(p for p in gen_data["profiles"] if p["key"] == "sustainability")
    apply_res = await client.put(
        "/api/nutrition/goals",
        json={
            "calories_kcal": sust_profile["calories_kcal"],
            "protein_g": sust_profile["protein_g"],
            "carbohydrates_g": sust_profile["carbs_g"],
            "fat_g": sust_profile["fat_g"],
        },
    )
    assert apply_res.status_code == 200
    updated_goals = apply_res.json()
    assert updated_goals["calories_kcal"] == sust_profile["calories_kcal"]
    assert updated_goals["protein_g"] == sust_profile["protein_g"]


@pytest.mark.asyncio
async def test_simultaneous_multi_macro_optimization_and_compliance(client: AsyncClient):
    """Test 7-day multi-macro optimization, target compliance evaluation, and diagnostic metadata."""
    await client.post(
        "/api/profile",
        json={
            "name": "Alex Smith",
            "date_of_birth": "1991-03-20",
            "gender": "male",
            "height_cm": 178.0,
            "weight_kg": 75.0,
            "activity_level": "moderately_active",
        },
    )
    await client.put(
        "/api/nutrition/goals",
        json={
            "calories_kcal": 2100.0,
            "protein_g": 130.0,
            "carbohydrates_g": 240.0,
            "fat_g": 65.0,
        },
    )

    gen_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Alex 7-Day Plan",
            "generation_strategy": "varied",
            "target_calories": 2100.0,
            "target_protein": 130.0,
            "target_carbohydrates": 240.0,
            "target_fat": 65.0,
        },
    )
    assert gen_res.status_code == 201
    plan = gen_res.json()

    assert len(plan["days"]) == 7
    overview = plan["weekly_overview"]
    assert overview is not None

    # Check status and acceptance criteria fields
    assert overview["plan_status"] in ("success", "best_effort")
    assert isinstance(overview["is_successful"], bool)
    assert isinstance(overview["constraint_count"], int)
    assert isinstance(overview["permitted_exception_count"], int)

    # If successful, constraint count must be <= 1
    if overview["is_successful"]:
        assert overview["constraint_count"] <= 1
        if overview["constraint_count"] == 1:
            assert overview["permitted_exception_count"] == 1
            assert len(overview["unmet_constraints"]) == 1
            ex = overview["unmet_constraints"][0]
            assert ex["is_permitted_exception"] is True
            assert ex["day_number"] is not None
            assert ex["nutrient"] is not None
            assert len(ex["explanation"]) > 0
        else:
            assert overview["permitted_exception_count"] == 0
    else:
        assert overview["plan_status"] == "best_effort"
        assert overview["constraint_count"] > 1

    # Verify strategy metrics
    strat = overview["strategy_metrics"]
    assert strat is not None
    assert strat["unique_ingredients_count"] > 0
    assert strat["unique_recipes_count"] > 0
    assert 0.0 <= strat["meal_repetition_rate"] <= 100.0
    assert 0.0 <= strat["ingredient_reuse_score"] <= 100.0
    assert strat["total_cooking_time_minutes"] > 0
    assert strat["shopping_list_item_count"] > 0
    assert 0.0 <= strat["target_compliance_rate"] <= 100.0


@pytest.mark.asyncio
async def test_strategy_differentiation_metrics(client: AsyncClient):
    """Verify Simple & Efficient yields higher ingredient reuse while Maximum Variety yields more unique recipes."""
    await client.post(
        "/api/profile",
        json={
            "name": "Jordan Metric",
            "date_of_birth": "1990-01-01",
            "gender": "female",
            "height_cm": 165.0,
            "weight_kg": 62.0,
            "activity_level": "lightly_active",
        },
    )

    # 1. Simple & Efficient plan
    simple_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Simple Plan",
            "generation_strategy": "simple",
            "target_calories": 1800.0,
            "target_protein": 110.0,
        },
    )
    assert simple_res.status_code == 201
    simple_plan = simple_res.json()
    simple_metrics = simple_plan["weekly_overview"]["strategy_metrics"]

    # 2. Maximum Variety plan
    varied_res = await client.post(
        "/api/meal-plans/generate",
        json={
            "name": "Varied Plan",
            "generation_strategy": "varied",
            "target_calories": 1800.0,
            "target_protein": 110.0,
        },
    )
    assert varied_res.status_code == 201
    varied_plan = varied_res.json()
    varied_metrics = varied_plan["weekly_overview"]["strategy_metrics"]

    # Maximum Variety should feature equal or greater recipe diversity
    assert varied_metrics["unique_recipes_count"] >= simple_metrics["unique_recipes_count"]
    # Simple & Efficient should have higher reuse or repetition rate
    assert (
        simple_metrics["ingredient_reuse_score"] >= varied_metrics["ingredient_reuse_score"]
        or simple_metrics["meal_repetition_rate"] >= varied_metrics["meal_repetition_rate"]
    )
