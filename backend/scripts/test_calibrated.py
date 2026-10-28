"""Test target-calibrated candidate generation."""

import sys
sys.path.insert(0, "backend")

from typing import Dict, List, Any
from app.data.built_in_recipes import BUILT_IN_RECIPES
from app.data.generic_foods import GENERIC_FOODS
from app.models.recipe import Recipe, RecipeIngredient
from app.models.food import Food
from app.domain.nutrition import scale_food_nutrients
from app.services.meal_planner_service import meal_planner_service
from scripts.test_combined_sim import build_mock_foods_and_recipes, evaluate_plan_days

def run():
    food_by_ext, built_in_recipes = build_mock_foods_and_recipes()
    cats = ["breakfast", "lunch", "dinner", "snacks"]
    cat_weights = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snacks": 0.15}
    tot_w = sum(cat_weights.values())

    scenarios = [
        ("1. High-Protein Weight Loss", 1800.0, 150.0, 170.0, 58.0, 30.0, None),
        ("2. Moderate Sustainability", 2000.0, 125.0, 225.0, 67.0, 30.0, None),
        ("3. Bulking Surplus", 2600.0, 160.0, 325.0, 72.0, 35.0, None),
        ("4. Lower-Calorie Deficit", 1400.0, 120.0, 130.0, 44.0, 25.0, None),
        ("5. Higher-Carb Endurance", 2400.0, 110.0, 360.0, 58.0, 35.0, None),
        ("6. Time Limit <= 30 min (2000 kcal)", 2000.0, 125.0, 225.0, 67.0, 30.0, 30),
        ("7. Time Limit <= 15 min (2000 kcal)", 2000.0, 125.0, 225.0, 67.0, 30.0, 15),
    ]

    for name, t_cal, t_p, t_c, t_f, t_fib, max_time in scenarios:
        c_targets = {c: (cat_weights[c] / tot_w) * t_cal for c in cats}
        p_ratio = (4.0 * t_p) / t_cal
        c_ratio = (4.0 * t_c) / t_cal
        f_ratio = (9.0 * t_f) / t_cal

        # Let's test generating calibrated candidates
        calibrated_cands = []
        cand_id = 5000

        # We create calibrated versions of the archetypes for each category
        # Archetype 1: Scramble (breakfast)
        # Archetype 2: Yogurt/Cottage Cheese bowl (breakfast/snack)
        # Archetype 3: Power Bowl (lunch/dinner)
        # Archetype 4: Quick Skillet (lunch/dinner)
        # Archetype 5: Wrap/Sandwich (lunch/snack)
        # Archetype 6: Protein snack (snack)
        # Let's test how close we get
        print(f"Scenario: {name}")

if __name__ == "__main__":
    run()

