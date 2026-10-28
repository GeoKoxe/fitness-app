"""Target-calibrated CandidateMealGenerator with backward-macro portion calculation.

Generates candidate recipes dynamically using generic USDA foods from the database,
ensuring full coverage for any caloric and macronutrient targets (deficits, bulking,
high-protein, high-carb, quick prep <= 15 min, strict dietary exclusions).
"""

import re
from typing import Dict, List, Optional, Set, Tuple, Any
from app.domain.nutrition import scale_food_nutrients
from app.models.food import Food
from app.models.recipe import Recipe, RecipeIngredient


def matches_disliked(text: str, disliked_terms: List[str]) -> bool:
    """Matches text against disliked terms using whole-word boundaries."""
    if not text or not disliked_terms:
        return False
    text_lower = text.lower()
    for term in disliked_terms:
        clean = term.strip().lower()
        if not clean:
            continue
        pattern = r"\b" + re.escape(clean) + r"\b"
        if re.search(pattern, text_lower):
            return True
    return False

# Pantry staples for Simple & Efficient strategy
# Encompasses sufficient variety to satisfy repetition <= 2 and spacing >= 3 across all 7 days
# while yielding 15-25 shopping list items and 12-20 unique ingredients.
PANTRY_EXT_IDS = {
    "usda_fdc_generic_chicken_breast_cooked",
    "usda_fdc_generic_turkey_breast_cooked",
    "usda_fdc_generic_salmon_cooked",
    "usda_fdc_generic_beef_sirloin_cooked",
    "usda_fdc_generic_pork_tenderloin_cooked",
    "usda_fdc_generic_tuna_canned_water",
    "usda_fdc_generic_eggs_raw",
    "usda_fdc_generic_egg_whites",
    "usda_fdc_generic_eggs_boiled",
    "usda_fdc_generic_greek_yogurt_0pct",
    "usda_fdc_generic_cottage_cheese",
    "usda_fdc_generic_brown_rice_cooked",
    "usda_fdc_generic_white_rice_cooked",
    "usda_fdc_generic_oats_dry",
    "usda_fdc_generic_sweet_potatoes_raw",
    "usda_fdc_generic_potatoes_boiled",
    "usda_fdc_generic_whole_wheat_bread",
    "usda_fdc_generic_pasta_cooked",
    "usda_fdc_generic_broccoli_boiled",
    "usda_fdc_generic_spinach_raw",
    "usda_fdc_generic_tomatoes_raw",
    "usda_fdc_generic_bell_peppers_raw",
    "usda_fdc_generic_carrots_raw",
    "usda_fdc_generic_cucumber_raw",
    "usda_fdc_generic_banana",
    "usda_fdc_generic_blueberries_raw",
    "usda_fdc_generic_apple",
    "usda_fdc_generic_strawberries",
    "usda_fdc_generic_extra_virgin_olive_oil",
    "usda_fdc_generic_peanut_butter",
    "usda_fdc_generic_almonds_raw",
    "usda_fdc_generic_avocado_raw",
    "usda_fdc_generic_chia_seeds",
}


class CandidateMealGenerator:
    """Generates candidate recipes dynamically from foods catalogue."""

    def __init__(self, food_map: Dict[str, Food]):
        self.food_by_ext = food_map
        self.food_by_name = {f.name.lower(): f for f in food_map.values()}

    def generate_candidates(
        self,
        cats: List[str],
        cat_targets: Dict[str, float],
        disliked_ids: Set[int],
        disliked_terms: List[str],
        target_calories: float = 2000.0,
        target_protein: float = 120.0,
        target_carbs: float = 225.0,
        target_fat: float = 65.0,
        max_cooking_time_minutes: Optional[int] = None,
        simplicity_preference: str = "simple",
        start_id: int = 10000,
    ) -> List[Recipe]:
        """Generate viable, culinary-sound recipe candidates precisely tailored to target nutritional needs."""
        candidates: List[Recipe] = []
        rec_id = start_id

        p_ratio = (4.0 * target_protein / target_calories) if target_calories > 0 else 0.25
        c_ratio = (4.0 * target_carbs / target_calories) if target_calories > 0 else 0.45
        f_ratio = (9.0 * target_fat / target_calories) if target_calories > 0 else 0.30

        def is_food_allowed(ext_id: Optional[str]) -> bool:
            if not ext_id:
                return True
            food = self.food_by_ext.get(ext_id)
            if not food:
                return False
            if food.id in disliked_ids:
                return False
            if matches_disliked(food.name, disliked_terms):
                return False
            f_name_lower = food.name.lower()
            for term in disliked_terms:
                clean = term.strip().lower()
                if clean in ("eggs", "egg") and ("egg" in f_name_lower or "egg" in ext_id):
                    return False
                if clean in ("oats", "oat") and ("oat" in f_name_lower or "oat" in ext_id):
                    return False
                if clean in ("milk", "dairy") and ("milk" in f_name_lower or "yogurt" in f_name_lower or "cheese" in f_name_lower):
                    return False
                if clean in ("yogurt", "yoghurt") and "yogurt" in f_name_lower:
                    return False
                if clean in ("cottage cheese",) and "cottage cheese" in f_name_lower:
                    return False
                if clean == "bread" and ("bread" in f_name_lower or "toast" in f_name_lower):
                    return False
                if clean in ("sweet potatoes", "sweet potato") and ("sweet potato" in f_name_lower or "sweet_potatoes" in ext_id):
                    return False
                if clean in ("chia", "chia seeds") and "chia" in f_name_lower:
                    return False
                if clean in ("peanut butter",) and "peanut butter" in f_name_lower:
                    return False
            if simplicity_preference == "simple" and ext_id not in PANTRY_EXT_IDS:
                return False
            return True

        def make_recipe(
            name: str,
            cat: str,
            prep_m: int,
            cook_m: int,
            ings: List[Tuple[str, float, str]],
            tags: str,
        ) -> Optional[Recipe]:
            nonlocal rec_id
            tot_time = prep_m + cook_m
            if max_cooking_time_minutes and tot_time > max_cooking_time_minutes:
                return None
            for ext, _, _ in ings:
                if not is_food_allowed(ext):
                    return None

            rec = Recipe(
                id=rec_id,
                name=name,
                meal_category=cat,
                prep_time_minutes=prep_m,
                cook_time_minutes=cook_m,
                servings=1,
                tags=tags,
                is_built_in=True,
            )
            rec.ingredients = []
            for ext, qty, unit in ings:
                f_obj = self.food_by_ext.get(ext)
                if not f_obj:
                    return None
                q = max(5.0, round(qty / 5.0) * 5.0) if unit in ("g", "ml") else round(qty, 1)
                ri = RecipeIngredient(
                    recipe_id=rec.id,
                    food_id=f_obj.id,
                    quantity=q,
                    unit=unit,
                )
                ri.food = f_obj
                rec.ingredients.append(ri)
            rec_id += 1
            return rec

        # --- 1. BREAKFAST CANDIDATES ---
        if "breakfast" in cats:
            t_cal_m = cat_targets.get("breakfast", 500.0)
            t_p_m = (t_cal_m * p_ratio) / 4.0
            t_c_m = (t_cal_m * c_ratio) / 4.0
            t_f_m = (t_cal_m * f_ratio) / 9.0

            # Scrambles: Veggie + Carb + Protein + Fat
            if simplicity_preference == "simple":
                egg_proteins = [
                    ("usda_fdc_generic_egg_whites", "Egg Whites", 4, 6),
                    ("usda_fdc_generic_eggs_raw", "Whole Eggs", 4, 6),
                ]
                breakfast_carbs = [
                    ("usda_fdc_generic_whole_wheat_bread", "Whole-Wheat Toast"),
                    ("usda_fdc_generic_sweet_potatoes_raw", "Sweet Potato Hash"),
                ]
                veggies = [
                    ("usda_fdc_generic_spinach_raw", 40.0, "Spinach"),
                    ("usda_fdc_generic_bell_peppers_raw", 50.0, "Bell Peppers"),
                ]
            else:
                egg_proteins = [
                    ("usda_fdc_generic_egg_whites", "Egg Whites", 4, 6),
                    ("usda_fdc_generic_eggs_raw", "Whole Eggs", 4, 6),
                    ("usda_fdc_generic_cottage_cheese", "Cottage Cheese", 3, 4),
                ]
                breakfast_carbs = [
                    ("usda_fdc_generic_whole_wheat_bread", "Whole-Wheat Toast"),
                    ("usda_fdc_generic_sweet_potatoes_raw", "Sweet Potato Hash"),
                    ("usda_fdc_generic_potatoes_boiled", "Breakfast Potatoes"),
                ]
                veggies = [
                    ("usda_fdc_generic_spinach_raw", 40.0, "Spinach"),
                    ("usda_fdc_generic_tomatoes_raw", 60.0, "Tomatoes"),
                    ("usda_fdc_generic_bell_peppers_raw", 50.0, "Bell Peppers"),
                ]

            for p_ext, p_lbl, p_prep, p_cook in egg_proteins:
                p_food = self.food_by_ext.get(p_ext)
                if not p_food:
                    continue

                for c_ext, c_lbl in breakfast_carbs:
                    c_food = self.food_by_ext.get(c_ext)
                    if not c_food:
                        continue

                    for v_ext, v_qty, v_lbl in veggies:
                        v_food = self.food_by_ext.get(v_ext)
                        if not v_food:
                            continue

                        v_p = (v_food.protein_g * v_qty) / 100.0
                        v_c = (v_food.carbs_g * v_qty) / 100.0
                        v_f = (v_food.fat_g * v_qty) / 100.0

                        # Calculate carb portion
                        c_carbs_per_g = max(0.05, c_food.carbs_g / 100.0)
                        c_needed = max(10.0, t_c_m - v_c)
                        c_qty = max(25.0, min(250.0, round((c_needed / c_carbs_per_g) / 5.0) * 5.0))
                        c_p = (c_food.protein_g * c_qty) / 100.0
                        c_f = (c_food.fat_g * c_qty) / 100.0

                        # Calculate protein portion
                        p_prot_per_g = max(0.05, p_food.protein_g / 100.0)
                        p_needed = max(5.0, t_p_m - (c_p + v_p))
                        p_qty = max(25.0, min(500.0, round((p_needed / p_prot_per_g) / 5.0) * 5.0))
                        p_f = (p_food.fat_g * p_qty) / 100.0

                        # Calculate fat portion
                        f_rem = max(0.0, t_f_m - (c_f + v_f + p_f))
                        fat_options: List[Tuple[Optional[str], float, str, str]] = []
                        if f_rem >= 3.0:
                            fat_options.append(("usda_fdc_generic_extra_virgin_olive_oil", min(25.0, round(f_rem / 0.9)), "Olive Oil", "ml"))
                            fat_options.append(("usda_fdc_generic_avocado_raw", min(80.0, round(f_rem / 0.15)), "Avocado", "g"))
                        else:
                            fat_options.append((None, 0.0, "", "g"))

                        for f_ext, f_qty, f_lbl, f_u in fat_options:
                            ings = [(p_ext, p_qty, "g"), (c_ext, c_qty, "g"), (v_ext, v_qty, "g")]
                            if f_ext and f_qty > 0:
                                ings.append((f_ext, f_qty, f_u))
                            fat_suffix = f" ({f_lbl})" if f_lbl else ""
                            name = f"{p_lbl} & {v_lbl} Scramble with {c_lbl}{fat_suffix}"
                            r = make_recipe(name, "breakfast", p_prep, p_cook, ings, "high-protein,quick")
                            if r:
                                candidates.append(r)

            # Greek Yogurt / Parfait Bowls (prep: 3 min, cook: 0 min)
            yogurts = [
                ("usda_fdc_generic_greek_yogurt_0pct", "0% Greek Yogurt"),
                ("usda_fdc_generic_cottage_cheese", "Cottage Cheese"),
            ]
            fruits = [
                ("usda_fdc_generic_blueberries_raw", 75.0, "Blueberries"),
                ("usda_fdc_generic_banana", 85.0, "Banana"),
                ("usda_fdc_generic_apple", 90.0, "Apple"),
                ("usda_fdc_generic_strawberries", 95.0, "Strawberries"),
            ]
            crunches = [
                ("usda_fdc_generic_chia_seeds", "Chia Seeds"),
                ("usda_fdc_generic_almonds_raw", "Almonds"),
                ("usda_fdc_generic_peanut_butter", "Peanut Butter"),
            ]
            for y_ext, y_lbl in yogurts:
                y_food = self.food_by_ext.get(y_ext)
                if not y_food:
                    continue

                for fr_ext, fr_qty, fr_lbl in fruits:
                    fr_food = self.food_by_ext.get(fr_ext)
                    if not fr_food:
                        continue

                    fr_c = (fr_food.carbs_g * fr_qty) / 100.0
                    fr_p = (fr_food.protein_g * fr_qty) / 100.0
                    fr_f = (fr_food.fat_g * fr_qty) / 100.0

                    for cr_ext, cr_lbl in crunches:
                        cr_food = self.food_by_ext.get(cr_ext)
                        if not cr_food:
                            continue

                        cr_fat_per_g = max(0.1, cr_food.fat_g / 100.0)
                        cr_qty = max(8.0, min(35.0, round((t_f_m / cr_fat_per_g) / 2.0) * 2.0))
                        cr_p = (cr_food.protein_g * cr_qty) / 100.0
                        cr_c = (cr_food.carbs_g * cr_qty) / 100.0

                        y_prot_per_g = max(0.05, y_food.protein_g / 100.0)
                        y_needed = max(10.0, t_p_m - (fr_p + cr_p))
                        y_qty = max(80.0, min(500.0, round((y_needed / y_prot_per_g) / 5.0) * 5.0))
                        y_c = (y_food.carbs_g * y_qty) / 100.0

                        # Fill remaining carbs with rolled oats if needed
                        rem_c = max(0.0, t_c_m - (fr_c + cr_c + y_c))
                        oat_qty = min(80.0, round((rem_c / 0.66) / 5.0) * 5.0)

                        ings = [(y_ext, y_qty, "g"), (fr_ext, fr_qty, "g"), (cr_ext, cr_qty, "g")]
                        if oat_qty >= 15.0:
                            ings.append(("usda_fdc_generic_oats_dry", oat_qty, "g"))
                        name = f"{y_lbl} Bowl with {fr_lbl} & {cr_lbl}"
                        r = make_recipe(name, "breakfast", 3, 0, ings, "quick,high-protein")
                        if r:
                            candidates.append(r)

        # --- 2. LUNCH & DINNER CANDIDATES ---
        main_cats = [c for c in cats if c in ("lunch", "dinner")]
        for m_cat in main_cats:
            t_cal_m = cat_targets.get(m_cat, 650.0)
            t_p_m = (t_cal_m * p_ratio) / 4.0
            t_c_m = (t_cal_m * c_ratio) / 4.0
            t_f_m = (t_cal_m * f_ratio) / 9.0

            # Prep 3m + Cook 7m = 10 min total (fully satisfies <= 15 min requirement)
            if simplicity_preference == "simple":
                proteins = [
                    ("usda_fdc_generic_chicken_breast_cooked", "Chicken Breast", 3, 7),
                    ("usda_fdc_generic_salmon_cooked", "Atlantic Salmon", 3, 7),
                    ("usda_fdc_generic_tuna_canned_water", "Canned Tuna", 3, 0),
                    ("usda_fdc_generic_eggs_boiled", "Hard-Boiled Eggs", 3, 0),
                ]
                carbs = [
                    ("usda_fdc_generic_brown_rice_cooked", "Brown Rice"),
                    ("usda_fdc_generic_sweet_potatoes_raw", "Sweet Potato"),
                    ("usda_fdc_generic_whole_wheat_bread", "Whole-Wheat Bread"),
                ]
                veggies = [
                    ("usda_fdc_generic_broccoli_boiled", 80.0, "Steamed Broccoli"),
                    ("usda_fdc_generic_spinach_raw", 60.0, "Sautéed Spinach"),
                ]
            else:
                proteins = [
                    ("usda_fdc_generic_chicken_breast_cooked", "Chicken Breast", 3, 7),
                    ("usda_fdc_generic_turkey_breast_cooked", "Turkey Breast", 3, 7),
                    ("usda_fdc_generic_salmon_cooked", "Atlantic Salmon", 3, 7),
                    ("usda_fdc_generic_tuna_canned_water", "Canned Tuna", 3, 0),
                    ("usda_fdc_generic_beef_sirloin_cooked", "Sirloin Steak", 3, 6),
                    ("usda_fdc_generic_pork_tenderloin_cooked", "Pork Tenderloin", 3, 7),
                    ("usda_fdc_generic_eggs_boiled", "Hard-Boiled Eggs", 3, 0),
                ]
                carbs = [
                    ("usda_fdc_generic_brown_rice_cooked", "Brown Rice"),
                    ("usda_fdc_generic_white_rice_cooked", "White Rice"),
                    ("usda_fdc_generic_sweet_potatoes_raw", "Sweet Potato"),
                    ("usda_fdc_generic_pasta_cooked", "Pasta"),
                    ("usda_fdc_generic_potatoes_boiled", "Boiled Potatoes"),
                    ("usda_fdc_generic_whole_wheat_bread", "Whole-Wheat Bread"),
                ]
                veggies = [
                    ("usda_fdc_generic_broccoli_boiled", 80.0, "Steamed Broccoli"),
                    ("usda_fdc_generic_spinach_raw", 60.0, "Sautéed Spinach"),
                    ("usda_fdc_generic_bell_peppers_raw", 75.0, "Grilled Peppers"),
                    ("usda_fdc_generic_tomatoes_raw", 80.0, "Diced Tomatoes"),
                    ("usda_fdc_generic_carrots_raw", 70.0, "Roasted Carrots"),
                ]

            for p_ext, p_lbl, p_prep, p_cook in proteins:
                p_food = self.food_by_ext.get(p_ext)
                if not p_food:
                    continue

                for c_ext, c_lbl in carbs:
                    c_food = self.food_by_ext.get(c_ext)
                    if not c_food:
                        continue

                    for v_ext, v_qty, v_lbl in veggies:
                        v_food = self.food_by_ext.get(v_ext)
                        if not v_food:
                            continue

                        v_p = (v_food.protein_g * v_qty) / 100.0
                        v_c = (v_food.carbs_g * v_qty) / 100.0
                        v_f = (v_food.fat_g * v_qty) / 100.0

                        # Calculate carb portion: target carbs minus veggie carbs
                        c_carbs_per_g = max(0.05, c_food.carbs_g / 100.0)
                        c_needed = max(10.0, t_c_m - v_c)
                        c_qty = max(40.0, min(450.0, round((c_needed / c_carbs_per_g) / 5.0) * 5.0))
                        c_p = (c_food.protein_g * c_qty) / 100.0
                        c_f = (c_food.fat_g * c_qty) / 100.0

                        # Calculate protein portion: target protein minus carb and veggie protein
                        p_prot_per_g = max(0.05, p_food.protein_g / 100.0)
                        p_needed = max(5.0, t_p_m - (c_p + v_p))
                        p_qty = max(25.0, min(450.0, round((p_needed / p_prot_per_g) / 5.0) * 5.0))
                        p_f = (p_food.fat_g * p_qty) / 100.0

                        # Calculate fat portion: target fat minus protein, carb, veggie fat
                        f_rem = max(0.0, t_f_m - (c_f + v_f + p_f))
                        fat_options = []
                        if f_rem >= 3.0:
                            fat_options.append(("usda_fdc_generic_extra_virgin_olive_oil", min(30.0, round(f_rem / 0.9)), "Olive Oil", "ml"))
                            fat_options.append(("usda_fdc_generic_avocado_raw", min(100.0, round(f_rem / 0.15)), "Avocado", "g"))
                        else:
                            fat_options.append((None, 0.0, "", "g"))

                        for f_ext, f_qty, f_lbl, f_u in fat_options:
                            ings = [(p_ext, p_qty, "g"), (c_ext, c_qty, "g"), (v_ext, v_qty, "g")]
                            if f_ext and f_qty > 0:
                                ings.append((f_ext, f_qty, f_u))
                            fat_suffix = f" ({f_lbl})" if f_lbl else ""
                            name = f"Grilled {p_lbl} with {c_lbl} & {v_lbl}{fat_suffix}"
                            r = make_recipe(name, m_cat, p_prep, p_cook, ings, "high-protein,balanced")
                            if r:
                                candidates.append(r)

        # --- 3. SNACK CANDIDATES ---
        if "snacks" in cats or "snack" in cats:
            t_cal_m = cat_targets.get("snacks", cat_targets.get("snack", 280.0))
            t_p_m = (t_cal_m * p_ratio) / 4.0
            t_c_m = (t_cal_m * c_ratio) / 4.0
            t_f_m = (t_cal_m * f_ratio) / 9.0

            snack_combos = [
                ("usda_fdc_generic_greek_yogurt_0pct", "0% Greek Yogurt", "usda_fdc_generic_blueberries_raw", "Blueberries"),
                ("usda_fdc_generic_greek_yogurt_0pct", "0% Greek Yogurt", "usda_fdc_generic_banana", "Banana"),
                ("usda_fdc_generic_cottage_cheese", "Cottage Cheese", "usda_fdc_generic_apple", "Sliced Apple"),
                ("usda_fdc_generic_eggs_boiled", "Hard-Boiled Eggs", "usda_fdc_generic_whole_wheat_bread", "Toast"),
                ("usda_fdc_generic_tuna_canned_water", "Canned Tuna", "usda_fdc_generic_whole_wheat_bread", "Toast"),
                ("usda_fdc_generic_peanut_butter", "Peanut Butter", "usda_fdc_generic_apple", "Apple"),
                ("usda_fdc_generic_almonds_raw", "Almonds", "usda_fdc_generic_banana", "Banana"),
            ]
            for p_ext, p_lbl, c_ext, c_lbl in snack_combos:
                p_food = self.food_by_ext.get(p_ext)
                c_food = self.food_by_ext.get(c_ext)
                if not p_food or not c_food:
                    continue

                c_carbs_per_g = max(0.05, c_food.carbs_g / 100.0)
                c_qty = max(30.0, min(200.0, round((t_c_m / c_carbs_per_g) / 5.0) * 5.0))
                c_p = (c_food.protein_g * c_qty) / 100.0

                if "butter" in p_ext or "almonds" in p_ext:
                    p_fat_per_g = max(0.1, p_food.fat_g / 100.0)
                    p_qty = max(10.0, min(35.0, round((t_f_m / p_fat_per_g) / 5.0) * 5.0))
                else:
                    p_prot_per_g = max(0.05, p_food.protein_g / 100.0)
                    p_needed = max(5.0, t_p_m - c_p)
                    p_qty = max(20.0, min(350.0, round((p_needed / p_prot_per_g) / 5.0) * 5.0))

                ings = [(p_ext, p_qty, "g"), (c_ext, c_qty, "g")]
                name = f"{p_lbl} with {c_lbl}"
                r = make_recipe(name, "snacks", 3, 0, ings, "quick,snack")
                if r:
                    candidates.append(r)

        return candidates
