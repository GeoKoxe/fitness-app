"""Test Phase A macro-aware ranking + CandidateMealGenerator."""

import sys
sys.path.insert(0, "backend")

from typing import Dict, List, Any
from app.data.built_in_recipes import BUILT_IN_RECIPES
from app.data.generic_foods import GENERIC_FOODS
from app.services.meal_planner_service import meal_planner_service
from app.services.candidate_meal_generator import CandidateMealGenerator
from app.models.recipe import Recipe, RecipeIngredient
from app.models.food import Food

def build_mock_foods_and_recipes():
    food_by_ext = {}
    for i, f in enumerate(GENERIC_FOODS, start=1):
        food_obj = Food(
            id=i,
            external_id=f["external_id"],
            name=f["name"],
            category=f.get("category", "Other"),
            calories_kcal=f["calories_kcal"],
            protein_g=f["protein_g"],
            carbs_g=f["carbs_g"],
            fat_g=f["fat_g"],
            fiber_g=f.get("fiber_g"),
            nutritional_basis=f.get("nutritional_basis", "per_100g"),
            serving_quantity=f.get("serving_quantity"),
            serving_unit=f.get("serving_unit"),
        )
        food_by_ext[f["external_id"]] = food_obj

    recipes = []
    for idx, r in enumerate(BUILT_IN_RECIPES, start=1):
        rec = Recipe(
            id=idx,
            name=r["name"],
            meal_category=r.get("category", "any"),
            prep_time_minutes=r.get("prep_time_minutes", 5),
            cook_time_minutes=r.get("cook_time_minutes", 0),
            servings=r.get("servings", 1),
            is_built_in=True,
        )
        rec.ingredients = []
        for ing in r.get("ingredients", []):
            f_obj = food_by_ext.get(ing["food_external_id"])
            if f_obj:
                ri = RecipeIngredient(
                    recipe_id=idx,
                    food_id=f_obj.id,
                    quantity=ing["quantity"],
                    unit=ing["unit"],
                )
                ri.food = f_obj
                rec.ingredients.append(ri)
        recipes.append(rec)
    return food_by_ext, recipes

def evaluate_plan_days(optimized_days, cats, t_cal, t_p, t_c, t_f):
    c_thresh = max(35.0, 0.025 * t_cal)
    p_thresh = max(3.0, 0.03 * t_p)
    cb_thresh = max(5.0, 0.03 * t_c)
    f_thresh = max(3.0, 0.03 * t_f)

    day_results = []
    total_unmet = 0

    for day in range(1, 8):
        day_cal = sum(optimized_days[day][c][2]["calories_kcal"] for c in cats)
        day_p = sum(optimized_days[day][c][2]["protein_g"] for c in cats)
        day_c = sum(optimized_days[day][c][2]["carbs_g"] for c in cats)
        day_f = sum(optimized_days[day][c][2]["fat_g"] for c in cats)

        unmet = []
        if abs(day_cal - t_cal) > c_thresh:
            unmet.append(f"Cal ({day_cal:.0f} vs {t_cal:.0f}, diff={day_cal - t_cal:+.0f})")
        if abs(day_p - t_p) > p_thresh:
            unmet.append(f"P ({day_p:.1f} vs {t_p:.1f}, diff={day_p - t_p:+.1f})")
        if abs(day_c - t_c) > cb_thresh:
            unmet.append(f"C ({day_c:.1f} vs {t_c:.1f}, diff={day_c - t_c:+.1f})")
        if abs(day_f - t_f) > f_thresh:
            unmet.append(f"F ({day_f:.1f} vs {t_f:.1f}, diff={day_f - t_f:+.1f})")

        total_unmet += len(unmet)
        day_results.append({
            "day": day,
            "cal": round(day_cal, 1),
            "p": round(day_p, 1),
            "c": round(day_c, 1),
            "f": round(day_f, 1),
            "unmet": unmet
        })
    return day_results, total_unmet

def run():
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
        filtered_builtins = built_in_recipes
        if max_time:
            filtered_builtins = [r for r in built_in_recipes if ((r.prep_time_minutes or 0) + (r.cook_time_minutes or 0)) <= max_time]

        dynamic_cands = generator.generate_candidates(
            cats=cats,
            cat_targets=c_targets,
            disliked_ids=set(),
            disliked_terms=[],
            target_calories=t_cal,
            target_protein=t_p,
            target_carbs=t_c,
            target_fat=t_f,
            max_cooking_time_minutes=max_time,
            simplicity_preference=strat,
            start_id=2000,
        )

        total_pool = filtered_builtins + dynamic_cands
        opt_days, warnings = meal_planner_service.optimize_weekly_plan(
            candidate_recipes=total_pool,
            cats=cats,
            cat_targets=c_targets,
            target_calories=t_cal,
            target_protein=t_p,
            target_carbs=t_c,
            target_fat=t_f,
            target_fiber=t_fib,
            tolerance_pct=10.0,
            simplicity_preference=strat,
            reuse_ingredients=True,
        )
        day_res, total_unmet = evaluate_plan_days(opt_days, cats, t_cal, t_p, t_c, t_f)
        status = "SUCCESS (0 unmet)" if total_unmet == 0 else ("PERMITTED EXCEPTION (1 unmet)" if total_unmet == 1 else f"FAIL ({total_unmet} unmet)")
        print(f"{name}: {status} (Total cands: {len(total_pool)})")

if __name__ == "__main__":
    run()
