"""Test coordinated pair-swap in Phase B."""

import sys
sys.path.insert(0, "backend")

from typing import Dict, List, Any, Tuple, Optional
from scripts.test_step_penalty import *
from app.services.candidate_meal_generator import SIMPLE_PANTRY_EXT_IDS

SIMPLE_PANTRY_EXT_IDS.update([
    'usda_fdc_generic_turkey_breast_cooked',
    'usda_fdc_generic_salmon_cooked',
    'usda_fdc_generic_beef_sirloin_cooked',
    'usda_fdc_generic_black_beans_canned',
    'usda_fdc_generic_potatoes_boiled',
    'usda_fdc_generic_sweet_potatoes_raw',
    'usda_fdc_generic_pasta_cooked',
    'usda_fdc_generic_carrots_raw',
    'usda_fdc_generic_tomatoes_raw',
    'usda_fdc_generic_bell_peppers_raw',
])

def run_test():
    food_by_ext, built_in_recipes = build_mock_foods_and_recipes()
    generator = CandidateMealGenerator(food_by_ext)
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
        strat = "simple"
        filtered_builtins = [r for r in built_in_recipes if ((r.prep_time_minutes or 0) + (r.cook_time_minutes or 0)) <= max_time] if max_time else built_in_recipes
        dynamic_cands = generator.generate_candidates(
            cats=cats, cat_targets=c_targets, disliked_ids=set(), disliked_terms=[],
            target_calories=t_cal, target_protein=t_p, target_carbs=t_c, target_fat=t_f,
            max_cooking_time_minutes=max_time, simplicity_preference=strat, start_id=4000
        )
        total_pool = filtered_builtins + dynamic_cands
        opt_days, warnings = run_custom_optimizer(
            candidate_recipes=total_pool, cats=cats, cat_targets=c_targets,
            target_calories=t_cal, target_protein=t_p, target_carbs=t_c, target_fat=t_f,
            target_fiber=t_fib, simplicity_preference=strat, reuse_ingredients=True
        )
        day_res, total_unmet = evaluate_plan_days(opt_days, cats, t_cal, t_p, t_c, t_f)
        status = "SUCCESS (0 unmet)" if total_unmet == 0 else ("PERMITTED EXCEPTION (1 unmet)" if total_unmet == 1 else f"FAIL ({total_unmet} unmet)")
        print(f"{name}: {status} ({total_unmet} unmet)")

if __name__ == "__main__":
    run_test()

