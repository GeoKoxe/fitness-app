import sys
sys.path.insert(0, "backend")

from typing import Dict, List, Any, Tuple, Optional
from app.data.built_in_recipes import BUILT_IN_RECIPES
from app.data.generic_foods import GENERIC_FOODS
from app.models.recipe import Recipe, RecipeIngredient
from app.models.food import Food
from app.domain.nutrition import scale_food_nutrients
from app.services.candidate_meal_generator import CandidateMealGenerator
from scripts.test_combined_sim import build_mock_foods_and_recipes, evaluate_plan_days


def run_tuned_optimizer(candidate_recipes, cats, cat_targets, target_calories, target_protein, target_carbs, target_fat, target_fiber, simplicity_preference="simple", reuse_ingredients=True):
    from app.services.meal_planner_service import (
        category_matches, is_cross_category_suitable, precompute_recipe_nutrients
    )

    precomputed = {
        (None, 1.0): {
            "calories_kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "fiber_g": 0.0,
            "items": [], "cat": "any", "recipe": None,
        }
    }
    for r in candidate_recipes:
        n1 = precompute_recipe_nutrients(r, 1.0)
        n1["recipe"] = r
        n1["cat"] = r.meal_category.lower().strip() if r.meal_category else "any"
        precomputed[(r.id, 1.0)] = n1

        n2 = precompute_recipe_nutrients(r, 2.0)
        n2["recipe"] = r
        n2["cat"] = r.meal_category.lower().strip() if r.meal_category else "any"
        precomputed[(r.id, 2.0)] = n2

    def get_category_options(category: str, level: int = 1):
        c_target = cat_targets.get(category, 500.0)
        if level == 1:
            matching = [r for r in candidate_recipes if category_matches(r.meal_category, category) or r.meal_category == "any"]
        else:
            matching = [
                r for r in candidate_recipes
                if is_cross_category_suitable(r, category)
                and (category_matches(r.meal_category, category) or (r.meal_category.lower().strip() in cats if r.meal_category else False) or r.meal_category == "any")
            ]
        opts = []
        for r in matching:
            opts.append((r.id, 1.0))
            r_cal = precomputed[(r.id, 1.0)]["calories_kcal"]
            if target_calories >= 2100 and category in ("lunch", "dinner", "snacks", "snack"):
                if r_cal > 0 and (c_target / r_cal >= 1.2 or r_cal * 2.0 <= c_target * 1.35):
                    opts.append((r.id, 2.0))
            elif target_calories >= 2500 and category in ("breakfast",):
                if r_cal > 0 and (c_target / r_cal >= 1.2 or r_cal * 2.0 <= c_target * 1.35):
                    opts.append((r.id, 2.0))
        return opts

    cat_level = {}
    cat_opts = {}
    max_repeats = {}
    warnings = []

    for c in cats:
        opts_l1 = get_category_options(c, level=1)
        r_ids_l1 = list(set(opt[0] for opt in opts_l1 if opt[0] is not None))
        if len(r_ids_l1) >= 4:
            cat_level[c] = 1
            cat_opts[c] = opts_l1
            max_repeats[c] = 2
        else:
            opts_l2 = get_category_options(c, level=2)
            r_ids_l2 = list(set(opt[0] for opt in opts_l2 if opt[0] is not None))
            if len(r_ids_l2) >= 4:
                cat_level[c] = 2
                cat_opts[c] = opts_l2
                max_repeats[c] = 2
            elif len(r_ids_l2) >= 3:
                cat_level[c] = 3
                cat_opts[c] = opts_l2
                max_repeats[c] = 3
            else:
                cat_level[c] = 4
                cat_opts[c] = opts_l2 if opts_l2 else [(None, 1.0)]
                max_repeats[c] = 2

    sorted_cats = sorted(cats, key=lambda c: len(set(opt[0] for opt in cat_opts[c] if opt[0] is not None)))
    weekly_assignments = {}
    day_forbidden = {d: set() for d in range(1, 8)}
    cat_schedules = {}

    p_rat = (4.0 * target_protein) / target_calories if target_calories > 0 else 0.25
    c_rat = (4.0 * target_carbs) / target_calories if target_calories > 0 else 0.45
    f_rat = (9.0 * target_fat) / target_calories if target_calories > 0 else 0.30

    for c in sorted_cats:
        tc = cat_targets.get(c, 500.0)
        tp = (tc * p_rat) / 4.0
        tcb = (tc * c_rat) / 4.0
        tf = (tc * f_rat) / 9.0
        cands = list(cat_opts[c])

        def cand_base_cost(opt):
            if opt[0] is None:
                return (1e6, 0)
            data = precomputed[opt]
            cal_diff = abs(data["calories_kcal"] - tc) / max(1.0, tc)
            p_diff = abs(data["protein_g"] - tp) / max(1.0, tp)
            c_diff = abs(data["carbs_g"] - tcb) / max(1.0, tcb)
            f_diff = abs(data["fat_g"] - tf) / max(1.0, tf)
            macro_err = 0.40 * cal_diff + 0.30 * p_diff + 0.15 * c_diff + 0.15 * f_diff

            overlap = 0
            if reuse_ingredients and simplicity_preference == "simple":
                rec = data["recipe"]
                if rec:
                    overlap = sum(1 for ing in rec.ingredients if ing.food_id)
            # Modest overlap bonus so macro fit remains primary
            overlap_bonus = min(0.06, 0.015 * overlap) if simplicity_preference == "simple" else min(0.03, 0.005 * overlap)
            return (macro_err - overlap_bonus, opt[0])

        m_rep = max_repeats[c]
        seq = [None] * 7
        local_assign = {}

        def backtrack(day: int) -> bool:
            if day > 7:
                return True
            ordered = sorted(cands, key=lambda opt: (
                999 if opt[0] is None else (len(weekly_assignments.get(opt[0], [])) + local_assign.get(opt[0], 0)),
                cand_base_cost(opt)
            ))
            for opt in ordered:
                rid = opt[0]
                if rid is None:
                    continue
                tot = len(weekly_assignments.get(rid, [])) + local_assign.get(rid, 0)
                if tot >= m_rep or rid in day_forbidden[day]:
                    continue
                if any(seq[prev_d - 1] and seq[prev_d - 1][0] == rid and abs(day - prev_d) < 3 for prev_d in range(1, day)):
                    continue
                if any(abs(day - prev_d) < 3 for prev_d in weekly_assignments.get(rid, [])):
                    continue
                seq[day - 1] = opt
                local_assign[rid] = local_assign.get(rid, 0) + 1
                if backtrack(day + 1):
                    return True
                seq[day - 1] = None
                local_assign[rid] -= 1
            return False

        found = backtrack(1)
        if not found:
            for day in range(1, 8):
                if seq[day - 1] is None:
                    for opt in cands:
                        rid = opt[0]
                        if rid is None:
                            continue
                        if (len(weekly_assignments.get(rid, [])) + local_assign.get(rid, 0)) >= m_rep or rid in day_forbidden[day]:
                            continue
                        if any(seq[prev_d - 1] and seq[prev_d - 1][0] == rid and abs(day - prev_d) < 3 for prev_d in range(1, 8)):
                            continue
                        if any(abs(day - prev_d) < 3 for prev_d in weekly_assignments.get(rid, [])):
                            continue
                        seq[day - 1] = opt
                        local_assign[rid] = local_assign.get(rid, 0) + 1
                        break
                    if seq[day - 1] is None:
                        seq[day - 1] = (None, 1.0)

        cat_schedules[c] = [s if s is not None else (None, 1.0) for s in seq]
        for day in range(1, 8):
            opt = cat_schedules[c][day - 1]
            if opt[0] is not None:
                weekly_assignments.setdefault(opt[0], []).append(day)
                day_forbidden[day].add(opt[0])

    solution = {(d, c): cat_schedules[c][d - 1] for d in range(1, 8) for c in cats}

    # Phase B: Multi-Macro Iterative Optimization with Strict Threshold Step Penalty
    def calc_nutr(combo):
        cal = sum(precomputed[opt]["calories_kcal"] for opt in combo)
        p = sum(precomputed[opt]["protein_g"] for opt in combo)
        cb = sum(precomputed[opt]["carbs_g"] for opt in combo)
        f = sum(precomputed[opt]["fat_g"] for opt in combo)
        fib = sum(precomputed[opt]["fiber_g"] for opt in combo)
        return cal, p, cb, f, fib

    c_thresh = max(35.0, 0.025 * target_calories)
    p_thresh = max(3.0, 0.03 * target_protein)
    cb_thresh = max(5.0, 0.03 * target_carbs)
    f_thresh = max(3.0, 0.03 * target_fat)

    def score_combo(combo):
        cal, p, cb, f, _ = calc_nutr(combo)
        err_cal = (cal - target_calories) / max(1.0, target_calories)
        err_p = (p - target_protein) / max(1.0, target_protein)
        err_c = (cb - target_carbs) / max(1.0, target_carbs)
        err_f = (f - target_fat) / max(1.0, target_fat)

        unmet = 0
        if abs(cal - target_calories) > c_thresh: unmet += 1
        if abs(p - target_protein) > p_thresh: unmet += 1
        if abs(cb - target_carbs) > cb_thresh: unmet += 1
        if abs(f - target_fat) > f_thresh: unmet += 1

        pen_step = 100.0 * unmet
        base_err = 0.35 * (err_cal ** 2) + 0.35 * (err_p ** 2) + 0.15 * (err_c ** 2) + 0.15 * (err_f ** 2)
        return base_err + pen_step

    for _ in range(50):
        improved = False
        for day in range(1, 8):
            combo = [solution[(day, c)] for c in cats]
            if any(opt[0] is None for opt in combo):
                continue
            best_swap = None
            best_swap_loss = score_combo(combo)

            for slot_idx, c_name in enumerate(cats):
                cur_opt = combo[slot_idx]
                cur_rid = cur_opt[0]
                if cur_rid is not None:
                    weekly_assignments[cur_rid].remove(day)
                    day_forbidden[day].remove(cur_rid)
                m_rep = max_repeats[c_name]

                for cand_opt in cat_opts[c_name]:
                    cand_rid = cand_opt[0]
                    if cand_opt == cur_opt or cand_rid is None:
                        continue
                    if len(weekly_assignments.get(cand_rid, [])) >= m_rep or cand_rid in day_forbidden[day]:
                        continue
                    if any(abs(day - d) < 3 for d in weekly_assignments.get(cand_rid, [])):
                        continue
                    test_combo = list(combo)
                    test_combo[slot_idx] = cand_opt
                    new_loss = score_combo(test_combo)
                    if new_loss < best_swap_loss:
                        best_swap_loss = new_loss
                        best_swap = (slot_idx, c_name, cur_opt, cand_opt, test_combo)

                if cur_rid is not None:
                    weekly_assignments[cur_rid].append(day)
                    day_forbidden[day].add(cur_rid)

            if best_swap:
                slot_idx, c_name, cur_opt, cand_opt, new_combo = best_swap
                cur_rid = cur_opt[0]
                cand_rid = cand_opt[0]
                if cur_rid is not None:
                    weekly_assignments[cur_rid].remove(day)
                    day_forbidden[day].remove(cur_rid)
                if cand_rid is not None:
                    weekly_assignments.setdefault(cand_rid, []).append(day)
                    day_forbidden[day].add(cand_rid)
                solution[(day, c_name)] = cand_opt
                improved = True
        if not improved:
            break

    optimized_days = {}
    for day in range(1, 8):
        optimized_days[day] = {}
        for c in cats:
            opt = solution[(day, c)]
            optimized_days[day][c] = (precomputed[opt]["recipe"], opt[1], precomputed[opt])
    return optimized_days, warnings


def test_all():
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

    print("=" * 80)
    print("TESTING ALL 7 SCENARIOS WITH TUNED OPTIMIZER + CALIBRATED GENERATOR")
    print("=" * 80)

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
        opt_days, warnings = run_tuned_optimizer(
            candidate_recipes=total_pool, cats=cats, cat_targets=c_targets,
            target_calories=t_cal, target_protein=t_p, target_carbs=t_c, target_fat=t_f,
            target_fiber=t_fib, simplicity_preference=strat, reuse_ingredients=True
        )
        day_res, total_unmet = evaluate_plan_days(opt_days, cats, t_cal, t_p, t_c, t_f)
        status = "SUCCESS (0 unmet)" if total_unmet == 0 else ("PERMITTED EXCEPTION (1 unmet)" if total_unmet == 1 else f"FAIL ({total_unmet} unmet)")
        print(f"\n{name}: {status}")
        print(f"  Candidate pool: {len(filtered_builtins)} built-in + {len(dynamic_cands)} dynamic = {len(total_pool)} total")
        for dr in day_res:
            flag_str = f" -> UNMET: {', '.join(dr['unmet'])}" if dr['unmet'] else " -> OK"
            print(f"  Day {dr['day']}: {dr['cal']:.0f} kcal, {dr['p']:.1f}g P, {dr['c']:.1f}g C, {dr['f']:.1f}g F{flag_str}")

if __name__ == "__main__":
    test_all()

