import sys
sys.path.insert(0, "backend")

from app.services.candidate_meal_generator import CandidateMealGenerator
from scripts.test_step_penalty import run_custom_optimizer
from scripts.test_combined_sim import build_mock_foods_and_recipes

food_by_ext, built_in_recipes = build_mock_foods_and_recipes()
generator = CandidateMealGenerator(food_by_ext)
cats = ["breakfast", "lunch", "dinner", "snacks"]
cat_weights = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snacks": 0.15}
tot_w = sum(cat_weights.values())

t_cal, t_p, t_c, t_f, t_fib = 1400.0, 120.0, 130.0, 44.0, 25.0
c_targets = {c: (cat_weights[c] / tot_w) * t_cal for c in cats}
dynamic_cands = generator.generate_candidates(cats, c_targets, set(), [], t_cal, t_p, t_c, t_f, None, "simple", 4000)
total_pool = built_in_recipes + dynamic_cands

opt_days, warnings = run_custom_optimizer(
    candidate_recipes=total_pool, cats=cats, cat_targets=c_targets,
    target_calories=t_cal, target_protein=t_p, target_carbs=t_c, target_fat=t_f,
    target_fiber=t_fib, simplicity_preference="simple", reuse_ingredients=True
)

for c in cats:
    rec, serv, nutr = opt_days[1][c]
    name = rec.name if rec else "None"
    rid = rec.id if rec else None
    print(f"Day 1 {c}: {name} (id={rid}, serv={serv}): {nutr['calories_kcal']} kcal, {nutr['protein_g']}g P, {nutr['carbs_g']}g C, {nutr['fat_g']}g F")

