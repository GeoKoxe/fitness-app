"""Audit and diagnosis of FitPulse meal candidate pool and nutritional coverage."""

import sys
sys.path.insert(0, "backend")

from typing import Dict, List, Any
from app.data.built_in_recipes import BUILT_IN_RECIPES
from app.data.generic_foods import GENERIC_FOODS
from app.domain.nutrition import scale_food_nutrients
from collections import defaultdict

def run_audit():
    print("=" * 80)
    print("FITPULSE MEAL CANDIDATE POOL AUDIT")
    print("=" * 80)

    food_by_ext = {f["external_id"]: f for f in GENERIC_FOODS}

    # 1. Compute exact nutritional profile for each recipe
    recipe_profiles = []
    missing_ingredients = 0

    for r in BUILT_IN_RECIPES:
        cal = 0.0
        p = 0.0
        c = 0.0
        f = 0.0
        fib = 0.0
        ings_valid = True

        for ing in r.get("ingredients", []):
            ext_id = ing.get("food_external_id")
            food = food_by_ext.get(ext_id)
            if not food:
                missing_ingredients += 1
                ings_valid = False
                continue

            scaled = scale_food_nutrients(
                calories_kcal=food["calories_kcal"],
                protein_g=food["protein_g"],
                carbs_g=food["carbs_g"],
                fat_g=food["fat_g"],
                quantity=ing["quantity"],
                nutritional_basis=food.get("nutritional_basis", "per_100g"),
                unit=ing["unit"],
                fiber_g=food.get("fiber_g"),
                serving_quantity=food.get("serving_quantity"),
            )
            cal += scaled["calories_kcal"] or 0.0
            p += scaled["protein_g"] or 0.0
            c += scaled["carbs_g"] or 0.0
            f += scaled["fat_g"] or 0.0
            fib += scaled.get("fiber_g") or 0.0

        base_servings = r.get("servings", 1) or 1
        per_serv_cal = cal / base_servings
        per_serv_p = p / base_servings
        per_serv_c = c / base_servings
        per_serv_f = f / base_servings
        per_serv_fib = fib / base_servings

        total_time = (r.get("prep_time_minutes") or 0) + (r.get("cook_time_minutes") or 0)

        # Macro energy percentages
        p_pct = (4.0 * per_serv_p / per_serv_cal * 100.0) if per_serv_cal > 0 else 0.0
        c_pct = (4.0 * per_serv_c / per_serv_cal * 100.0) if per_serv_cal > 0 else 0.0
        f_pct = (9.0 * per_serv_f / per_serv_cal * 100.0) if per_serv_cal > 0 else 0.0

        recipe_profiles.append({
            "name": r["name"],
            "category": r.get("category", "any"),
            "servings": base_servings,
            "prep_time": r.get("prep_time_minutes", 0),
            "cook_time": r.get("cook_time_minutes", 0),
            "total_time": total_time,
            "cal": round(per_serv_cal, 1),
            "p": round(per_serv_p, 1),
            "c": round(per_serv_c, 1),
            "f": round(per_serv_f, 1),
            "fib": round(per_serv_fib, 1),
            "p_pct": round(p_pct, 1),
            "c_pct": round(c_pct, 1),
            "f_pct": round(f_pct, 1),
            "ingredients": [ing["food_external_id"] for ing in r.get("ingredients", [])]
        })

    print(f"Total built-in recipes: {len(recipe_profiles)}")
    print(f"Missing ingredient mappings: {missing_ingredients}")
    print()

    # 2. Breakdown by category
    by_cat = defaultdict(list)
    for rp in recipe_profiles:
        by_cat[rp["category"]].append(rp)

    for cat in ["breakfast", "lunch", "dinner", "snack"]:
        recs = by_cat[cat]
        print(f"--- Category: {cat.upper()} ({len(recs)} recipes) ---")
        cals = [r["cal"] for r in recs]
        ps = [r["p"] for r in recs]
        cs = [r["c"] for r in recs]
        fs = [r["f"] for r in recs]
        p_pcts = [r["p_pct"] for r in recs]
        c_pcts = [r["c_pct"] for r in recs]
        f_pcts = [r["f_pct"] for r in recs]

        print(f"  Calories range: {min(cals):.0f} - {max(cals):.0f} kcal (avg: {sum(cals)/len(cals):.0f})")
        print(f"  Protein range:  {min(ps):.1f} - {max(ps):.1f} g (avg: {sum(ps)/len(ps):.1f}g, avg %: {sum(p_pcts)/len(p_pcts):.1f}%)")
        print(f"  Carbs range:    {min(cs):.1f} - {max(cs):.1f} g (avg: {sum(cs)/len(cs):.1f}g, avg %: {sum(c_pcts)/len(c_pcts):.1f}%)")
        print(f"  Fat range:      {min(fs):.1f} - {max(fs):.1f} g (avg: {sum(fs)/len(fs):.1f}g, avg %: {sum(f_pcts)/len(f_pcts):.1f}%)")

        # High protein recipes in category (>= 30% protein)
        hp = [r for r in recs if r["p_pct"] >= 30.0]
        print(f"  High-protein (>=30% P): {len(hp)} / {len(recs)} recipes -> {[r['name'] for r in hp]}")
        # Low carb recipes in category (<= 25% C)
        lc = [r for r in recs if r["c_pct"] <= 25.0]
        print(f"  Low-carb (<=25% C):     {len(lc)} / {len(recs)} recipes -> {[r['name'] for r in lc]}")
        # Low fat recipes in category (<= 20% F)
        lf = [r for r in recs if r["f_pct"] <= 20.0]
        print(f"  Low-fat (<=20% F):      {len(lf)} / {len(recs)} recipes -> {[r['name'] for r in lf]}")
        print()

    # 3. Cooking Time Constraints
    print("--- Cooking Time Filter Survival ---")
    for max_time in [15, 30, 45, 60]:
        print(f"Max cooking time <= {max_time} min:")
        for cat in ["breakfast", "lunch", "dinner", "snack"]:
            surviving = [r for r in by_cat[cat] if r["total_time"] <= max_time]
            print(f"  {cat}: {len(surviving)} / {len(by_cat[cat])} survive")
    print()

    # 4. Dietary Exclusions / Dislikes Impact
    print("--- Dietary Exclusions Survival ---")
    common_dislikes = {
        "No dairy (milk, yogurt, cheese, butter)": ["milk", "dairy", "yogurt", "cheese", "butter"],
        "No eggs": ["egg", "eggs"],
        "No poultry/chicken/turkey": ["chicken", "turkey"],
        "No seafood/fish": ["salmon", "tuna", "cod", "fish"],
        "Vegetarian (no chicken, beef, turkey, fish, pork)": ["chicken", "beef", "turkey", "salmon", "tuna", "cod", "meat", "pork"],
        "No nuts/peanuts": ["peanut", "almond", "walnut"],
        "No oats/oatmeal": ["oats", "oatmeal"],
    }

    for label, terms in common_dislikes.items():
        print(f"Dislike: {label}")
        for cat in ["breakfast", "lunch", "dinner", "snack"]:
            surviving = []
            for r in by_cat[cat]:
                # Check if recipe has any disliked ingredients
                disliked = False
                for ing_id in r["ingredients"]:
                    for t in terms:
                        if t in ing_id.lower():
                            disliked = True
                            break
                    if disliked:
                        break
                if not disliked:
                    surviving.append(r)
            print(f"  {cat}: {len(surviving)} / {len(by_cat[cat])} survive (needed: >= 4 for strict variety)")
    print()

if __name__ == "__main__":
    run_audit()
