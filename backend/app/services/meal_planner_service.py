import datetime
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.domain.nutrition import (
    round_portion_quantity,
    scale_food_nutrients,
    validate_portion_quantity,
)
from app.models.food import Food
from app.models.meal_log import MealLog
from app.models.meal_plan import (
    DislikedFood,
    MealPlan,
    MealPlannerPreferences,
    PlannedMeal,
    PlannedMealItem,
    ShoppingListItem,
)
from app.models.nutrition_goal import NutritionGoal
from app.models.recipe import Recipe, RecipeIngredient
from app.repositories.food_repository import food_repository
from app.repositories.recipe_repository import recipe_repository
from app.schemas.meal_log import MealLogCreate
from app.schemas.meal_plan import (
    DayMealPlanResponse,
    DislikedFoodResponse,
    DislikeIngredientResponse,
    LoggedItemSummary,
    LogPlannedMealRequest,
    LogPlannedMealResponse,
    MealPlanGenerateRequest,
    MealPlanResponse,
    PlannedMealItemResponse,
    PlannedMealResponse,
    PlannerPreferencesResponse,
    PlannerPreferencesUpdate,
    StrategyMetricsResponse,
    UnmetConstraintDetail,
    WeeklyNutritionOverview,
)
from app.services.meal_log_service import meal_log_service
from app.services.recipe_service import recipe_service
from app.services.candidate_meal_generator import CandidateMealGenerator


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


def category_matches(recipe_cat: Optional[str], target_cat: Optional[str]) -> bool:
    """Check if recipe category matches target category with normalization for snack/snacks/any."""
    if not recipe_cat or not target_cat:
        return False
    r = recipe_cat.strip().lower()
    t = target_cat.strip().lower()
    if r == t:
        return True
    if r in ("snack", "snacks") and t in ("snack", "snacks"):
        return True
    if r == "any":
        return True
    return False


def is_cross_category_suitable(recipe: Recipe, target_category: str) -> bool:
    """Check if a recipe from another category is genuinely appropriate for target_category."""
    if not recipe or not recipe.meal_category:
        return True
    rcat = recipe.meal_category.lower().strip()
    tcat = target_category.lower().strip()
    if category_matches(rcat, tcat):
        return True

    if tcat in ("lunch", "dinner") and rcat in ("lunch", "dinner"):
        return True

    if tcat == "breakfast" and rcat in ("snack", "snacks"):
        name_lower = recipe.name.lower()
        wholesome_tokens = ["yogurt", "oat", "parfait", "smoothie", "toast", "egg", "fruit", "muffin", "chia", "nut", "bowl"]
        return any(tok in name_lower for tok in wholesome_tokens)

    if tcat in ("snack", "snacks") and rcat == "breakfast":
        return (recipe.prep_time_minutes or 0) + (recipe.cook_time_minutes or 0) <= 25

    return False


def check_recipe_repetition_and_spacing(
    recipe_id: int,
    day_number: int,
    assignments: Dict[int, List[int]],
    max_occurrences: int = 2,
    min_spacing_days: int = 3,
) -> Tuple[bool, Optional[str]]:
    """Enforces repetition and calendar day spacing rules."""
    days = assignments.get(recipe_id, [])
    if len(days) >= max_occurrences:
        return False, f"Recipe already used {len(days)} times (max {max_occurrences})"
    for d in days:
        if abs(day_number - d) < min_spacing_days:
            return False, f"Spacing violation: already scheduled on Day {d} (minimum spacing: {min_spacing_days} days)"
    return True, None


def check_target_compatibility(
    target_calories: float,
    target_protein: Optional[float],
    target_carbs: Optional[float],
    target_fat: Optional[float],
) -> Tuple[bool, Optional[str], float]:
    """Check whether calories and macronutrient targets are mathematically compatible.

    Using the standard Atwater energy relationship:
    calories = 4 * protein_g + 4 * carbohydrates_g + 9 * fat_g
    """
    if not target_protein or not target_carbs or not target_fat:
        return True, None, target_calories

    if target_protein <= 0 or target_carbs <= 0 or target_fat <= 0 or target_calories <= 0:
        return True, None, target_calories

    expected_cal = 4.0 * target_protein + 4.0 * target_carbs + 9.0 * target_fat
    diff_cal = abs(expected_cal - target_calories)
    diff_pct = (diff_cal / target_calories) * 100.0

    if diff_pct > 7.5 and diff_cal > 75.0:
        msg = (
            f"Configured macronutrient targets ({int(round(target_protein))}g protein, "
            f"{int(round(target_carbs))}g carbs, {int(round(target_fat))}g fat) provide approximately "
            f"{int(round(expected_cal))} kcal (via 4/4/9 kcal/g energy conversion). This deviates by "
            f"{diff_pct:.1f}% from your daily calorie target of {int(round(target_calories))} kcal. "
            "All configured goals cannot be satisfied simultaneously."
        )
        return False, msg, expected_cal

    return True, None, expected_cal


def extract_plan_targets(
    notes: Optional[str], default_goal: Optional[NutritionGoal]
) -> Tuple[float, float, float, float, float]:
    """Extract plan's saved targets from plan.notes, or fall back to profile's NutritionGoal."""
    t_cal = default_goal.calories_kcal if (default_goal and default_goal.calories_kcal is not None) else 2000.0
    t_p = default_goal.protein_g if (default_goal and default_goal.protein_g is not None) else 120.0
    t_c = default_goal.carbs_g if (default_goal and default_goal.carbs_g is not None) else 225.0
    t_f = default_goal.fat_g if (default_goal and default_goal.fat_g is not None) else 65.0
    t_fib = default_goal.fiber_g if (default_goal and default_goal.fiber_g is not None) else 30.0

    if notes and "[Targets:" in notes:
        m = re.search(
            r"\[Targets:\s*cal=([\d.]+),\s*p=([\d.]+),\s*c=([\d.]+),\s*f=([\d.]+)(?:,\s*fib=([\d.]+))?\]",
            notes,
        )
        if m:
            try:
                t_cal = float(m.group(1))
                t_p = float(m.group(2))
                t_c = float(m.group(3))
                t_f = float(m.group(4))
                if m.group(5):
                    t_fib = float(m.group(5))
            except (ValueError, TypeError):
                pass
    return t_cal, t_p, t_c, t_f, t_fib


def normalize_unit_and_value(quantity: float, unit: str) -> Tuple[str, float, str]:
    """
    Returns (family, normalized_value, canonical_unit).
    family: 'mass' (normalized to g), 'volume' (normalized to ml), or discrete unit.
    """
    u = (unit or "").lower().strip()
    if u in ("g", "gram", "grams"):
        return ("mass", quantity, "g")
    elif u in ("kg", "kilogram", "kilograms"):
        return ("mass", quantity * 1000.0, "g")
    elif u in ("mg", "milligram", "milligrams"):
        return ("mass", quantity * 0.001, "g")
    elif u in ("ml", "milliliter", "milliliters", "millilitre", "millilitres"):
        return ("volume", quantity, "ml")
    elif u in ("l", "liter", "liters", "litre", "litres"):
        return ("volume", quantity * 1000.0, "ml")
    elif u in ("cl", "centiliter"):
        return ("volume", quantity * 10.0, "ml")
    elif u in ("dl", "deciliter"):
        return ("volume", quantity * 100.0, "ml")
    else:
        return (u or "item", quantity, u or "item")


def precompute_recipe_nutrients(r: Recipe, servings: float = 1.0) -> Dict[str, Any]:
    """Precompute exact scaled item nutrition for a recipe with whole-serving portions."""
    recipe_base = r.servings if r.servings > 0 else 1
    eff_ratio = servings / recipe_base
    m_cal = 0.0
    m_p = 0.0
    m_c = 0.0
    m_f = 0.0
    m_fib = 0.0
    items_data = []

    for ing in r.ingredients:
        rounded_qty = round_portion_quantity(ing.quantity * eff_ratio, ing.unit)
        food = ing.food
        if food:
            scaled = scale_food_nutrients(
                calories_kcal=food.calories_kcal,
                protein_g=food.protein_g,
                carbs_g=food.carbs_g,
                fat_g=food.fat_g,
                quantity=rounded_qty,
                nutritional_basis=food.nutritional_basis,
                unit=ing.unit,
                fiber_g=food.fiber_g,
                serving_quantity=food.serving_quantity,
            )
            i_cal = scaled["calories_kcal"] or 0.0
            i_p = scaled["protein_g"] or 0.0
            i_c = scaled["carbs_g"] or 0.0
            i_f = scaled["fat_g"] or 0.0
            i_fib = scaled["fiber_g"]

            m_cal += i_cal
            m_p += i_p
            m_c += i_c
            m_f += i_f
            if i_fib is not None:
                m_fib += i_fib

            items_data.append(
                {
                    "food_id": food.id,
                    "food_name": food.name,
                    "quantity": rounded_qty,
                    "unit": ing.unit,
                    "calories_kcal": round(i_cal, 1),
                    "protein_g": round(i_p, 1),
                    "carbs_g": round(i_c, 1),
                    "fat_g": round(i_f, 1),
                    "fiber_g": round(i_fib, 1) if i_fib is not None else None,
                }
            )

    return {
        "calories_kcal": round(m_cal, 1),
        "protein_g": round(m_p, 1),
        "carbs_g": round(m_c, 1),
        "fat_g": round(m_f, 1),
        "fiber_g": round(m_fib, 1),
        "items": items_data,
    }


class MealPlannerService:
    def get_or_create_preferences(
        self, db: Session, user_profile_id: int
    ) -> MealPlannerPreferences:
        pref = (
            db.query(MealPlannerPreferences)
            .filter(MealPlannerPreferences.user_profile_id == user_profile_id)
            .first()
        )
        if not pref:
            pref = MealPlannerPreferences(
                user_profile_id=user_profile_id,
                enabled_categories="breakfast,lunch,dinner,snacks",
                disliked_foods="",
                max_cooking_time_minutes=None,
                simplicity_preference="simple",
                daily_budget=None,
                reuse_ingredients=True,
                target_tolerance_pct=10.0,
            )
            db.add(pref)
            db.commit()
            db.refresh(pref)
        return pref

    def get_disliked_foods(
        self, db: Session, user_profile_id: int
    ) -> List[DislikedFoodResponse]:
        records = (
            db.query(DislikedFood)
            .filter(DislikedFood.user_profile_id == user_profile_id)
            .order_by(DislikedFood.created_at.desc())
            .all()
        )
        responses: List[DislikedFoodResponse] = []
        for r in records:
            food = r.food
            responses.append(
                DislikedFoodResponse(
                    id=r.id,
                    user_profile_id=r.user_profile_id,
                    food_id=r.food_id,
                    food_name=r.food_name,
                    food_category=food.category if food else None,
                    food_source=food.source if food else None,
                    created_at=r.created_at,
                )
            )
        return responses

    def add_disliked_food(
        self, db: Session, user_profile_id: int, food_name: str, food_id: Optional[int] = None
    ) -> DislikedFoodResponse:
        name_clean = food_name.strip()
        existing = (
            db.query(DislikedFood)
            .filter(
                DislikedFood.user_profile_id == user_profile_id,
                or_(
                    (DislikedFood.food_id == food_id) if food_id else False,
                    DislikedFood.food_name.ilike(name_clean),
                ),
            )
            .first()
        )
        if existing:
            food = existing.food
            return DislikedFoodResponse(
                id=existing.id,
                user_profile_id=existing.user_profile_id,
                food_id=existing.food_id,
                food_name=existing.food_name,
                food_category=food.category if food else None,
                food_source=food.source if food else None,
                created_at=existing.created_at,
            )

        if not food_id:
            matched_food = db.query(Food).filter(Food.name.ilike(name_clean)).first()
            if matched_food:
                food_id = matched_food.id

        item = DislikedFood(
            user_profile_id=user_profile_id,
            food_id=food_id,
            food_name=name_clean,
        )
        db.add(item)

        pref = self.get_or_create_preferences(db, user_profile_id)
        current_list = [s.strip() for s in pref.disliked_foods.split(",") if s.strip()]
        if name_clean.lower() not in [s.lower() for s in current_list]:
            current_list.append(name_clean)
            pref.disliked_foods = ",".join(current_list)

        db.commit()
        db.refresh(item)
        food = item.food
        return DislikedFoodResponse(
            id=item.id,
            user_profile_id=item.user_profile_id,
            food_id=item.food_id,
            food_name=item.food_name,
            food_category=food.category if food else None,
            food_source=food.source if food else None,
            created_at=item.created_at,
        )

    def remove_disliked_food(
        self, db: Session, user_profile_id: int, disliked_id: int
    ) -> bool:
        item = (
            db.query(DislikedFood)
            .filter(
                DislikedFood.id == disliked_id,
                DislikedFood.user_profile_id == user_profile_id,
            )
            .first()
        )
        if not item:
            return False

        food_name_removed = item.food_name
        db.delete(item)

        pref = self.get_or_create_preferences(db, user_profile_id)
        current_list = [s.strip() for s in pref.disliked_foods.split(",") if s.strip()]
        new_list = [s for s in current_list if s.lower() != food_name_removed.lower()]
        pref.disliked_foods = ",".join(new_list)

        db.commit()
        return True

    def get_all_disliked_filters(
        self, db: Session, user_profile_id: int
    ) -> Tuple[Set[int], List[str]]:
        disliked_records = (
            db.query(DislikedFood)
            .filter(DislikedFood.user_profile_id == user_profile_id)
            .all()
        )
        disliked_ids: Set[int] = {r.food_id for r in disliked_records if r.food_id is not None}
        disliked_terms: List[str] = [r.food_name.strip() for r in disliked_records if r.food_name.strip()]

        pref = self.get_or_create_preferences(db, user_profile_id)
        if pref.disliked_foods:
            for term in pref.disliked_foods.split(","):
                t = term.strip()
                if t and t.lower() not in [x.lower() for x in disliked_terms]:
                    disliked_terms.append(t)

        return disliked_ids, disliked_terms

    def is_recipe_disliked(
        self, recipe: Recipe, disliked_ids: Set[int], disliked_terms: List[str]
    ) -> bool:
        if matches_disliked(recipe.name, disliked_terms):
            return True
        for ing in recipe.ingredients:
            if ing.food_id and ing.food_id in disliked_ids:
                return True
            if ing.food and matches_disliked(ing.food.name, disliked_terms):
                return True
        return False

    def get_active_plan(
        self, db: Session, user_profile_id: int
    ) -> Optional[MealPlan]:
        return (
            db.query(MealPlan)
            .filter(
                MealPlan.user_profile_id == user_profile_id,
                MealPlan.is_active.is_(True),
            )
            .order_by(MealPlan.created_at.desc())
            .first()
        )

    def optimize_weekly_plan(
        self,
        candidate_recipes: List[Recipe],
        cats: List[str],
        cat_targets: Dict[str, float],
        target_calories: float,
        target_protein: float,
        target_carbs: float,
        target_fat: float,
        target_fiber: float,
        tolerance_pct: float,
        simplicity_preference: str,
        reuse_ingredients: bool,
    ) -> Tuple[Dict[int, Dict[str, Tuple[Optional[Recipe], float, Dict[str, Any]]]], List[str]]:
        """Deterministic 4-tier constraint-aware weekly scheduling and nutrition optimizer.

        Guarantees slot completeness whenever a valid solution exists under:
        Level 1: Native categories, repetition <= 2, spacing >= 3 days.
        Level 2: Cross-category alternatives (e.g. wholesome breakfast snacks), repetition <= 2, spacing >= 3.
        Level 3: Controlled repetition relaxation (repetition <= 3 with spacing >= 3) when K_c < 4.
        Level 4: Genuine infeasibility transparently reported; incomplete slots left with 0.0 kcal.
        """
        tol_f = tolerance_pct / 100.0
        warnings: List[str] = []

        # 1. Precompute item nutrition for serv=1.0 and serv=2.0
        precomputed: Dict[Tuple[Optional[int], float], Dict[str, Any]] = {
            (None, 1.0): {
                "calories_kcal": 0.0,
                "protein_g": 0.0,
                "carbs_g": 0.0,
                "fat_g": 0.0,
                "fiber_g": 0.0,
                "items": [],
                "cat": "any",
                "recipe": None,
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

        # 2. Build Category Options under Relaxation Hierarchy
        def get_category_options(category: str, level: int = 1) -> List[Tuple[Optional[int], float]]:
            c_target = cat_targets.get(category, 500.0)
            if level == 1:
                matching = [
                    r for r in candidate_recipes
                    if category_matches(r.meal_category, category) or r.meal_category == "any"
                ]
            else:
                matching = [
                    r for r in candidate_recipes
                    if is_cross_category_suitable(r, category)
                    and (
                        category_matches(r.meal_category, category)
                        or (r.meal_category.lower().strip() in cats if r.meal_category else False)
                        or r.meal_category == "any"
                    )
                ]

            opts: List[Tuple[Optional[int], float]] = []
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

        cat_level: Dict[str, int] = {}
        cat_opts: Dict[str, List[Tuple[Optional[int], float]]] = {}
        max_repeats: Dict[str, int] = {}

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
                    warnings.append(
                        f"Due to dietary exclusions, suitable cross-category recipes were included for {c} to complete your plan without violating variety rules."
                    )
                elif len(r_ids_l1) >= 3:
                    cat_level[c] = 3
                    cat_opts[c] = opts_l1
                    max_repeats[c] = 3
                    warnings.append(
                        f"Strict dietary exclusions left only {len(r_ids_l1)} eligible recipes for {c}. Repetition limit was relaxed to 3 occurrences with spacing >= 3 days to guarantee a complete weekly plan."
                    )
                elif len(r_ids_l2) > 0:
                    cat_level[c] = 4
                    cat_opts[c] = opts_l2
                    max_repeats[c] = 2
                    warnings.append(
                        f"Only {len(r_ids_l2)} eligible recipe(s) available for {c} under active dietary exclusions. At least 4 recipes are required to fill 7 days under repetition and spacing rules. Incomplete slot(s) left for user selection."
                    )
                else:
                    cat_level[c] = 4
                    cat_opts[c] = [(None, 1.0)]
                    max_repeats[c] = 2
                    warnings.append(
                        f"No eligible recipes available for {c} under active dietary exclusions. Slots left incomplete."
                    )

        # Sort categories by fewest candidate recipe IDs first (Most Constrained Variable First heuristic)
        sorted_cats = sorted(cats, key=lambda c: len(set(opt[0] for opt in cat_opts[c] if opt[0] is not None)))

        # 3. Constraint-Aware Backtracking Scheduling (Phase A)
        weekly_assignments: Dict[int, List[int]] = {}
        day_forbidden: Dict[int, Set[int]] = {d: set() for d in range(1, 8)}
        cat_schedules: Dict[str, List[Tuple[Optional[int], float]]] = {}

        p_rat = (4.0 * target_protein) / target_calories if target_calories > 0 else 0.25
        c_rat = (4.0 * target_carbs) / target_calories if target_calories > 0 else 0.45
        f_rat = (9.0 * target_fat) / target_calories if target_calories > 0 else 0.30

        for c in sorted_cats:
            tc = cat_targets.get(c, 500.0)
            tp = (tc * p_rat) / 4.0
            tcb = (tc * c_rat) / 4.0
            tf = (tc * f_rat) / 9.0
            cands = list(cat_opts[c])

            def cand_base_cost(opt: Tuple[Optional[int], float]) -> Tuple[float, int]:
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
                overlap_bonus = (
                    min(0.06, 0.015 * overlap)
                    if simplicity_preference == "simple"
                    else min(0.02, 0.003 * overlap)
                )
                reuse_bonus = 0.05 if (simplicity_preference == "simple" and len(weekly_assignments.get(opt[0], [])) > 0) else 0.0
                return (macro_err - overlap_bonus - reuse_bonus, opt[0])

            m_rep = max_repeats[c]
            seq: List[Optional[Tuple[Optional[int], float]]] = [None] * 7
            local_assign: Dict[int, int] = {}

            def backtrack_category_days(day: int) -> bool:
                if day > 7:
                    return True
                ordered_cands = sorted(
                    cands,
                    key=lambda opt: (
                        999 if opt[0] is None else (len(weekly_assignments.get(opt[0], [])) + local_assign.get(opt[0], 0)),
                        cand_base_cost(opt),
                    ),
                )
                for opt in ordered_cands:
                    rid = opt[0]
                    if rid is None:
                        continue
                    tot_uses = len(weekly_assignments.get(rid, [])) + local_assign.get(rid, 0)
                    if tot_uses >= m_rep:
                        continue
                    if rid in day_forbidden[day]:
                        continue
                    spacing_ok = True
                    for prev_d in range(1, day):
                        prev_opt = seq[prev_d - 1]
                        if prev_opt and prev_opt[0] == rid and abs(day - prev_d) < 3:
                            spacing_ok = False
                            break
                    if not spacing_ok:
                        continue
                    for prev_d in weekly_assignments.get(rid, []):
                        if abs(day - prev_d) < 3:
                            spacing_ok = False
                            break
                    if not spacing_ok:
                        continue

                    seq[day - 1] = opt
                    local_assign[rid] = local_assign.get(rid, 0) + 1
                    if backtrack_category_days(day + 1):
                        return True
                    seq[day - 1] = None
                    local_assign[rid] -= 1
                return False

            found = backtrack_category_days(1)
            if not found:
                for day in range(1, 8):
                    if seq[day - 1] is None:
                        for opt in cands:
                            rid = opt[0]
                            if rid is None:
                                continue
                            tot_uses = len(weekly_assignments.get(rid, [])) + local_assign.get(rid, 0)
                            if tot_uses >= m_rep:
                                continue
                            if rid in day_forbidden[day]:
                                continue
                            spacing_ok = True
                            for prev_d in range(1, 8):
                                prev_opt = seq[prev_d - 1]
                                if prev_opt and prev_opt[0] == rid and abs(day - prev_d) < 3:
                                    spacing_ok = False
                                    break
                            if not spacing_ok:
                                continue
                            for prev_d in weekly_assignments.get(rid, []):
                                if abs(day - prev_d) < 3:
                                    spacing_ok = False
                                    break
                            if spacing_ok:
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

        solution: Dict[Tuple[int, str], Tuple[Optional[int], float]] = {}
        for day in range(1, 8):
            for c in cats:
                solution[(day, c)] = cat_schedules[c][day - 1]

        # 4. Multi-Macro Iterative Optimization among Complete Valid Plans (Phase B)
        def calc_nutr(combo: List[Tuple[Optional[int], float]]) -> Tuple[float, float, float, float, float]:
            cal = sum(precomputed[opt]["calories_kcal"] for opt in combo)
            p = sum(precomputed[opt]["protein_g"] for opt in combo)
            cb = sum(precomputed[opt]["carbs_g"] for opt in combo)
            f = sum(precomputed[opt]["fat_g"] for opt in combo)
            fib = sum(precomputed[opt]["fiber_g"] for opt in combo)
            return cal, p, cb, f, fib

        # Strict penalty for target constraint thresholds based on plan tolerance
        c_thresh = max(35.0, tol_f * target_calories)
        p_thresh = max(3.0, tol_f * target_protein)
        cb_thresh = max(5.0, tol_f * target_carbs)
        f_thresh = max(3.0, tol_f * target_fat)

        def score_combo(combo: List[Tuple[Optional[int], float]]) -> float:
            cal, p, cb, f, _ = calc_nutr(combo)
            err_cal = (cal - target_calories) / max(1.0, target_calories)
            err_p = (p - target_protein) / max(1.0, target_protein)
            err_c = (cb - target_carbs) / max(1.0, target_carbs)
            err_f = (f - target_fat) / max(1.0, target_fat)

            unmet = 0
            if abs(cal - target_calories) > c_thresh:
                unmet += 1
            if abs(p - target_protein) > p_thresh:
                unmet += 1
            if abs(cb - target_carbs) > cb_thresh:
                unmet += 1
            if abs(f - target_fat) > f_thresh:
                unmet += 1

            pen_step = 100.0 * unmet
            loss = 0.35 * (err_cal ** 2) + 0.35 * (err_p ** 2) + 0.15 * (err_c ** 2) + 0.15 * (err_f ** 2)
            return loss + pen_step

        for _ in range(50):
            improved = False
            for day in range(1, 8):
                combo = [solution[(day, c)] for c in cats]
                if any(opt[0] is None for opt in combo):
                    continue
                cal, p, cb, f, _ = calc_nutr(combo)

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
                        if len(weekly_assignments.get(cand_rid, [])) >= m_rep:
                            continue
                        if cand_rid in day_forbidden[day]:
                            continue
                        if any(abs(day - d) < 3 for d in weekly_assignments.get(cand_rid, [])):
                            continue
                        test_combo = list(combo)
                        test_combo[slot_idx] = cand_opt
                        new_loss = score_combo(test_combo)
                        # Avoid gratuitously reusing a recipe already scheduled on another day
                        # for negligible sub-calorie micro-differences (< 0.005 loss).
                        # Legitimate target satisfaction improvements (loss drop ~100) are never blocked.
                        reuse_cost = 0.005 if len(weekly_assignments.get(cand_rid, [])) > 0 else 0.0
                        if new_loss + reuse_cost < best_swap_loss:
                            best_swap_loss = new_loss + reuse_cost
                            best_swap = (slot_idx, c_name, cur_opt, cand_opt, test_combo)

                    if cur_rid is not None:
                        weekly_assignments[cur_rid].append(day)
                        day_forbidden[day].add(cur_rid)

                if best_swap:
                    slot_idx, c_name, old_opt, new_opt, new_combo = best_swap
                    old_rid = old_opt[0]
                    new_rid = new_opt[0]
                    if old_rid is not None:
                        weekly_assignments[old_rid].remove(day)
                        day_forbidden[day].remove(old_rid)
                    if new_rid is not None:
                        weekly_assignments.setdefault(new_rid, []).append(day)
                        day_forbidden[day].add(new_rid)
                    solution[(day, c_name)] = new_opt
                    improved = True
            if not improved:
                break

        # 5. Build Final Structured Days Output
        result: Dict[int, Dict[str, Tuple[Optional[Recipe], float, Dict[str, Any]]]] = {}
        for day in range(1, 8):
            result[day] = {}
            for c in cats:
                opt = solution[(day, c)]
                rec = precomputed[opt]["recipe"]
                serv = opt[1]
                nutr_data = precomputed[opt]
                result[day][c] = (rec, serv, nutr_data)

        return result, warnings

    def generate_plan(
        self, db: Session, user_profile_id: int, req: MealPlanGenerateRequest
    ) -> MealPlan:
        """Deterministic weekly nutrition optimization 7-day meal plan generator."""
        # 1. Resolve Targets
        target = (
            db.query(NutritionGoal)
            .filter(NutritionGoal.user_profile_id == user_profile_id)
            .first()
        )
        t_cal = req.target_calories or (target.calories_kcal if (target and target.calories_kcal is not None) else 2000.0)
        t_protein = req.target_protein or (target.protein_g if (target and target.protein_g is not None) else 120.0)
        t_carbs = req.target_carbs or (target.carbs_g if (target and target.carbs_g is not None) else 225.0)
        t_fat = req.target_fat or (target.fat_g if (target and target.fat_g is not None) else 65.0)
        t_fiber = req.target_fiber or (target.fiber_g if (target and target.fiber_g is not None) else 30.0)

        # 2. Resolve dates
        start_date = req.start_date or datetime.date.today()
        end_date = start_date + datetime.timedelta(days=6)

        # 3. Resolve categories and macro distribution
        cats = [c.strip().lower() for c in req.enabled_categories if c.strip()]
        if not cats:
            cats = ["breakfast", "lunch", "dinner", "snacks"]

        cat_weights = {
            "breakfast": 0.25,
            "lunch": 0.35,
            "dinner": 0.35,
            "snacks": 0.15,
            "snack": 0.15,
        }
        total_weight = sum(cat_weights.get(c, 0.25) for c in cats)
        cat_targets = {
            c: (cat_weights.get(c, 0.25) / total_weight) * t_cal for c in cats
        }

        # 4. Disliked foods
        if req.disliked_foods:
            for item in req.disliked_foods:
                term = item.strip()
                if term:
                    try:
                        self.add_disliked_food(db, user_profile_id, food_name=term)
                    except Exception as ex:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Failed to persist disliked food '{term}': {str(ex)}",
                        )

        disliked_ids, disliked_terms = self.get_all_disliked_filters(db, user_profile_id)

        # Selected tolerance (saved for backward compatibility)
        pref = self.get_or_create_preferences(db, user_profile_id)
        if req.target_tolerance_pct and 10.0 <= req.target_tolerance_pct <= 15.0:
            selected_tol = float(req.target_tolerance_pct)
            pref.target_tolerance_pct = selected_tol
            db.add(pref)
        else:
            selected_tol = float(pref.target_tolerance_pct) if pref.target_tolerance_pct else 10.0

        # 5. Fetch and filter candidate recipes
        all_recipes = recipe_repository.get_all(
            db, user_profile_id=user_profile_id, include_built_in=True
        )

        valid_recipes: List[Recipe] = []
        for r in all_recipes:
            total_time = (r.prep_time_minutes or 0) + (r.cook_time_minutes or 0)
            if req.max_cooking_time_minutes and total_time > req.max_cooking_time_minutes:
                continue
            if self.is_recipe_disliked(r, disliked_ids, disliked_terms):
                continue
            valid_recipes.append(r)

        # Expand candidate pool with target-tailored dynamic candidates from generic USDA foods
        foods = db.query(Food).all()
        # Use detached food instances so transient candidates do not cascade into db session
        food_map = {
            f.external_id: Food(
                id=f.id,
                external_id=f.external_id,
                name=f.name,
                category=f.category,
                calories_kcal=f.calories_kcal,
                protein_g=f.protein_g,
                carbs_g=f.carbs_g,
                fat_g=f.fat_g,
                fiber_g=f.fiber_g,
                nutritional_basis=f.nutritional_basis,
                serving_quantity=f.serving_quantity,
            )
            for f in foods
            if f.external_id
        }
        if food_map:
            cand_generator = CandidateMealGenerator(food_map)
            dynamic_cands = cand_generator.generate_candidates(
                cats=cats,
                cat_targets=cat_targets,
                disliked_ids=disliked_ids,
                disliked_terms=disliked_terms,
                target_calories=t_cal,
                target_protein=t_protein,
                target_carbs=t_carbs,
                target_fat=t_fat,
                max_cooking_time_minutes=req.max_cooking_time_minutes,
                simplicity_preference=req.simplicity_preference,
                start_id=10000,
            )
            valid_recipes.extend(dynamic_cands)

        # 6. Deactivate existing active plans
        db.query(MealPlan).filter(
            MealPlan.user_profile_id == user_profile_id, MealPlan.is_active.is_(True)
        ).update({"is_active": False})

        # Save targets tag in plan.notes so to_response consistently evaluates against exact plan targets
        plan_name = req.name or f"Plan starting {start_date.strftime('%b %d')}"
        notes_targets = f"[Targets: cal={t_cal:.1f}, p={t_protein:.1f}, c={t_carbs:.1f}, f={t_fat:.1f}, fib={t_fiber:.1f}]"
        plan_notes = f"{plan_name}. Preference: {req.simplicity_preference}. {notes_targets}"

        plan = MealPlan(
            user_profile_id=user_profile_id,
            name=plan_name,
            start_date=start_date,
            end_date=end_date,
            is_active=True,
            target_tolerance_pct=selected_tol,
            notes=plan_notes,
        )
        db.add(plan)
        db.flush()

        # 7. Run Redesigned 7-Day Nutrition Optimization
        optimized_days, shortage_warnings = self.optimize_weekly_plan(
            candidate_recipes=valid_recipes,
            cats=cats,
            cat_targets=cat_targets,
            target_calories=t_cal,
            target_protein=t_protein,
            target_carbs=t_carbs,
            target_fat=t_fat,
            target_fiber=t_fiber,
            tolerance_pct=selected_tol,
            simplicity_preference=req.simplicity_preference,
            reuse_ingredients=req.reuse_ingredients,
        )

        persisted_recipe_map: Dict[int, int] = {}

        for day_num in range(1, 8):
            cur_date = start_date + datetime.timedelta(days=day_num - 1)
            for cat in cats:
                target_meal_cal = cat_targets.get(cat, 500.0)
                selected_recipe, servings_multiplier, nutr_dict = optimized_days[day_num][cat]

                if selected_recipe:
                    meal_name = selected_recipe.name
                    if selected_recipe.id >= 10000:
                        if selected_recipe.id in persisted_recipe_map:
                            recipe_id = persisted_recipe_map[selected_recipe.id]
                        else:
                            existing = (
                                db.query(Recipe)
                                .filter(
                                    Recipe.name == selected_recipe.name,
                                    Recipe.meal_category == selected_recipe.meal_category,
                                    Recipe.is_built_in.is_(False),
                                )
                                .first()
                            )
                            if existing:
                                recipe_id = existing.id
                            else:
                                new_rec = Recipe(
                                    user_profile_id=None,
                                    name=selected_recipe.name,
                                    meal_category=selected_recipe.meal_category,
                                    servings=1,
                                    prep_time_minutes=selected_recipe.prep_time_minutes,
                                    cook_time_minutes=selected_recipe.cook_time_minutes,
                                    instructions="Combine ingredients and prepare as indicated.",
                                    tags=selected_recipe.tags or "generated,plan_recipe",
                                    is_built_in=False,
                                )
                                db.add(new_rec)
                                db.flush()
                                for ing in selected_recipe.ingredients:
                                    db_ing = RecipeIngredient(
                                        recipe_id=new_rec.id,
                                        food_id=ing.food_id,
                                        quantity=ing.quantity,
                                        unit=ing.unit,
                                    )
                                    db.add(db_ing)
                                db.flush()
                                recipe_id = new_rec.id
                            persisted_recipe_map[selected_recipe.id] = recipe_id
                    else:
                        recipe_id = selected_recipe.id
                    notes_str = f"Target: ~{int(target_meal_cal)} kcal"
                else:
                    meal_name = f"Incomplete {cat.capitalize()} Slot (Choose Recipe)"
                    recipe_id = None
                    notes_str = f"Target: ~{int(target_meal_cal)} kcal. Incomplete slot: use Replace to assign a recipe."

                planned_meal = PlannedMeal(
                    meal_plan_id=plan.id,
                    plan_date=cur_date,
                    day_number=day_num,
                    meal_category=cat,
                    recipe_id=recipe_id,
                    name=meal_name,
                    servings=round(servings_multiplier, 1),
                    calories_kcal=round(nutr_dict["calories_kcal"], 1),
                    protein_g=round(nutr_dict["protein_g"], 1),
                    carbs_g=round(nutr_dict["carbs_g"], 1),
                    fat_g=round(nutr_dict["fat_g"], 1),
                    fiber_g=round(nutr_dict["fiber_g"], 1) if nutr_dict.get("fiber_g") is not None else None,
                    notes=notes_str,
                )
                db.add(planned_meal)
                db.flush()

                for item_data in nutr_dict.get("items", []):
                    item = PlannedMealItem(
                        planned_meal_id=planned_meal.id,
                        food_id=item_data["food_id"],
                        quantity=round(item_data["quantity"], 1),
                        unit=item_data["unit"],
                        calories_kcal=round(item_data["calories_kcal"], 1),
                        protein_g=round(item_data["protein_g"], 1),
                        carbs_g=round(item_data["carbs_g"], 1),
                        fat_g=round(item_data["fat_g"], 1),
                        fiber_g=round(item_data["fiber_g"], 1) if item_data.get("fiber_g") is not None else None,
                    )
                    db.add(item)

        # 8. Shopping list
        self.regenerate_shopping_list(db, plan.id)

        if shortage_warnings:
            shortage_summary = "; ".join(shortage_warnings)
            plan.notes = f"{plan.notes or ''} [Advisories: {shortage_summary}]"[:1000]

        db.commit()
        db.refresh(plan)
        return plan

    def regenerate_shopping_list(self, db: Session, meal_plan_id: int) -> None:
        """Aggregate all ingredients across the 7-day plan into ShoppingListItem records with unit conversion."""
        db.query(ShoppingListItem).filter(ShoppingListItem.meal_plan_id == meal_plan_id).delete()

        items = (
            db.query(PlannedMealItem)
            .join(PlannedMeal, PlannedMeal.id == PlannedMealItem.planned_meal_id)
            .filter(PlannedMeal.meal_plan_id == meal_plan_id)
            .all()
        )

        aggregated: Dict[Tuple[int, str], Dict[str, Any]] = {}
        for it in items:
            if not it.food_id:
                continue
            food = food_repository.get_by_id(db, it.food_id)
            if not food:
                continue

            fam, norm_val, canon_unit = normalize_unit_and_value(it.quantity, it.unit)
            key = (it.food_id, fam)
            if key not in aggregated:
                aggregated[key] = {
                    "food_id": food.id,
                    "ingredient_name": food.name,
                    "category": food.category or "Other",
                    "fam": fam,
                    "total_norm_val": 0.0,
                    "canon_unit": canon_unit,
                }
            aggregated[key]["total_norm_val"] += norm_val

        for agg in aggregated.values():
            fam = agg["fam"]
            tot_val = agg["total_norm_val"]
            if fam == "mass":
                if tot_val >= 1000.0:
                    final_qty = round(tot_val / 1000.0, 2)
                    final_unit = "kg"
                else:
                    final_qty = round(tot_val, 1)
                    final_unit = "g"
            elif fam == "volume":
                if tot_val >= 1000.0:
                    final_qty = round(tot_val / 1000.0, 2)
                    final_unit = "l"
                else:
                    final_qty = round(tot_val, 1)
                    final_unit = "ml"
            else:
                final_qty = round(tot_val, 1)
                final_unit = agg["canon_unit"]

            sli = ShoppingListItem(
                meal_plan_id=meal_plan_id,
                food_id=agg["food_id"],
                ingredient_name=agg["ingredient_name"],
                category=agg["category"],
                total_quantity=final_qty,
                unit=final_unit,
                is_checked=False,
                is_excluded=False,
            )
            db.add(sli)

    def to_response(
        self, db: Session, plan: MealPlan, user_profile_id: int
    ) -> MealPlanResponse:
        """Convert a MealPlan model into a complete structured MealPlanResponse with strict target evaluation."""
        target = (
            db.query(NutritionGoal)
            .filter(NutritionGoal.user_profile_id == user_profile_id)
            .first()
        )
        t_cal, t_p, t_c, t_f, t_fib = extract_plan_targets(plan.notes, target)

        day_map: Dict[int, List[PlannedMeal]] = {d: [] for d in range(1, 8)}
        for pm in plan.planned_meals:
            day_map[pm.day_number].append(pm)

        days_resp: List[DayMealPlanResponse] = []
        total_week_cal = 0.0
        total_week_p = 0.0
        total_week_c = 0.0
        total_week_f = 0.0
        total_week_fib = 0.0

        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        for d_num in range(1, 8):
            meals_for_day = day_map.get(d_num, [])
            p_date = plan.start_date + datetime.timedelta(days=d_num - 1)
            day_name = day_names[p_date.weekday()]

            day_cal = sum(m.calories_kcal for m in meals_for_day)
            day_p = sum(m.protein_g for m in meals_for_day)
            day_c = sum(m.carbs_g for m in meals_for_day)
            day_f = sum(m.fat_g for m in meals_for_day)
            day_fib = sum((m.fiber_g or 0.0) for m in meals_for_day)

            total_week_cal += day_cal
            total_week_p += day_p
            total_week_c += day_c
            total_week_f += day_f
            total_week_fib += day_fib

            meals_resp: List[PlannedMealResponse] = []
            for m in meals_for_day:
                items_resp = [
                    PlannedMealItemResponse(
                        id=it.id,
                        planned_meal_id=it.planned_meal_id,
                        food_id=it.food_id,
                        food_name=it.food.name if it.food else "Item",
                        quantity=it.quantity,
                        unit=it.unit,
                        calories_kcal=it.calories_kcal,
                        protein_g=it.protein_g,
                        carbs_g=it.carbs_g,
                        fat_g=it.fat_g,
                        fiber_g=it.fiber_g,
                    )
                    for it in m.items
                ]
                meals_resp.append(
                    PlannedMealResponse(
                        id=m.id,
                        meal_plan_id=m.meal_plan_id,
                        plan_date=m.plan_date,
                        day_number=m.day_number,
                        meal_category=m.meal_category,
                        recipe_id=m.recipe_id,
                        food_id=m.food_id,
                        name=m.name,
                        servings=m.servings,
                        notes=m.notes,
                        calories_kcal=m.calories_kcal,
                        protein_g=m.protein_g,
                        carbs_g=m.carbs_g,
                        fat_g=m.fat_g,
                        fiber_g=m.fiber_g,
                        items=items_resp,
                    )
                )

            days_resp.append(
                DayMealPlanResponse(
                    day_number=d_num,
                    plan_date=p_date,
                    day_name=day_name,
                    meals=meals_resp,
                    total_calories=round(day_cal, 1),
                    total_protein=round(day_p, 1),
                    total_carbs=round(day_c, 1),
                    total_fat=round(day_f, 1),
                    total_fiber=round(day_fib, 1),
                )
            )

        avg_cal = round(total_week_cal / 7.0, 1)
        avg_p = round(total_week_p / 7.0, 1)
        avg_c = round(total_week_c / 7.0, 1)
        avg_f = round(total_week_f / 7.0, 1)
        avg_fib = round(total_week_fib / 7.0, 1)

        adh_cal = round((avg_cal / t_cal) * 100.0, 1) if t_cal and t_cal > 0 else None
        adh_p = round((avg_p / t_p) * 100.0, 1) if t_p and t_p > 0 else None
        adh_c = round((avg_c / t_c) * 100.0, 1) if t_c and t_c > 0 else None
        adh_f = round((avg_f / t_f) * 100.0, 1) if t_f and t_f > 0 else None
        adh_fib = round((avg_fib / t_fib) * 100.0, 1) if t_fib and t_fib > 0 else None

        # Feature G: Evaluate constraints consistently across 7 days and 4 nutrients (28 checks)
        all_unmet_constraints: List[UnmetConstraintDetail] = []
        plan_tol_pct = plan.target_tolerance_pct if (plan.target_tolerance_pct and plan.target_tolerance_pct > 0) else 10.0
        tol_f = plan_tol_pct / 100.0

        for d in days_resp:
            d_num = d.day_number
            d_name = d.day_name

            # Skip checking placeholder/incomplete days
            has_placeholder = any(m.recipe_id is None for m in d.meals)
            if has_placeholder:
                continue

            cal_thresh = max(35.0, tol_f * t_cal)
            cal_delta = round(d.total_calories - t_cal, 1)
            if abs(cal_delta) > cal_thresh:
                all_unmet_constraints.append(
                    UnmetConstraintDetail(
                        target_name="Calories",
                        target_value=t_cal,
                        actual_value=d.total_calories,
                        status="unmet",
                        day_number=d_num,
                        nutrient="Calories",
                        discrepancy=cal_delta,
                        tolerance_pct=plan_tol_pct,
                        is_permitted_exception=False,
                        explanation=f"Day {d_num} ({d_name}): Calories {d.total_calories:.0f} kcal deviate by {cal_delta:+.0f} kcal from target {t_cal:.0f} kcal (threshold ±{cal_thresh:.0f} kcal, ±{plan_tol_pct:.0f}%).",
                        suggestion="Adjust portions or accompaniment foods to balance daily caloric energy.",
                    )
                )

            p_thresh = max(3.0, tol_f * t_p)
            p_delta = round(d.total_protein - t_p, 1)
            if abs(p_delta) > p_thresh:
                all_unmet_constraints.append(
                    UnmetConstraintDetail(
                        target_name="Protein",
                        target_value=t_p,
                        actual_value=d.total_protein,
                        status="unmet",
                        day_number=d_num,
                        nutrient="Protein",
                        discrepancy=p_delta,
                        tolerance_pct=plan_tol_pct,
                        is_permitted_exception=False,
                        explanation=f"Day {d_num} ({d_name}): Protein {d.total_protein:.1f}g deviates by {p_delta:+.1f}g from target {t_p:.0f}g (threshold ±{p_thresh:.1f}g, ±{plan_tol_pct:.0f}%).",
                        suggestion="Add or adjust a protein-dense staple item (e.g. Greek yogurt, egg whites, whey).",
                    )
                )

            c_thresh = max(5.0, tol_f * t_c)
            c_delta = round(d.total_carbs - t_c, 1)
            if abs(c_delta) > c_thresh:
                all_unmet_constraints.append(
                    UnmetConstraintDetail(
                        target_name="Carbohydrates",
                        target_value=t_c,
                        actual_value=d.total_carbs,
                        status="unmet",
                        day_number=d_num,
                        nutrient="Carbohydrates",
                        discrepancy=c_delta,
                        tolerance_pct=plan_tol_pct,
                        is_permitted_exception=False,
                        explanation=f"Day {d_num} ({d_name}): Carbohydrates {d.total_carbs:.1f}g deviate by {c_delta:+.1f}g from target {t_c:.0f}g (threshold ±{c_thresh:.1f}g, ±{plan_tol_pct:.0f}%).",
                        suggestion="Add or adjust complex carbohydrate portions (e.g. oats, banana, rice).",
                    )
                )

            f_thresh = max(3.0, tol_f * t_f)
            f_delta = round(d.total_fat - t_f, 1)
            if abs(f_delta) > f_thresh:
                all_unmet_constraints.append(
                    UnmetConstraintDetail(
                        target_name="Fat",
                        target_value=t_f,
                        actual_value=d.total_fat,
                        status="unmet",
                        day_number=d_num,
                        nutrient="Fat",
                        discrepancy=f_delta,
                        tolerance_pct=plan_tol_pct,
                        is_permitted_exception=False,
                        explanation=f"Day {d_num} ({d_name}): Fat {d.total_fat:.1f}g deviates by {f_delta:+.1f}g from target {t_f:.0f}g (threshold ±{f_thresh:.1f}g, ±{plan_tol_pct:.0f}%).",
                        suggestion="Adjust healthy fats (e.g. olive oil dressing, almonds, peanut butter).",
                    )
                )

        # Target mathematical compatibility check for manual targets
        is_compat, compat_msg, expected_cal = check_target_compatibility(
            target_calories=t_cal,
            target_protein=t_p,
            target_carbs=t_c,
            target_fat=t_f,
        )
        if not is_compat and compat_msg:
            all_unmet_constraints.append(
                UnmetConstraintDetail(
                    target_name="Target Compatibility",
                    target_value=t_cal,
                    actual_value=round(expected_cal, 1),
                    status="conflict",
                    discrepancy=round(expected_cal - t_cal, 1),
                    is_permitted_exception=False,
                    explanation=compat_msg,
                    suggestion=compat_msg,
                )
            )

        # Check for placeholder shortage in plan
        has_placeholders = any(m.recipe_id is None for d in days_resp for m in d.meals)
        if has_placeholders or (plan.notes and "Advisories:" in plan.notes):
            all_unmet_constraints.append(
                UnmetConstraintDetail(
                    target_name="Recipe Variety",
                    target_value=len(plan.planned_meals),
                    actual_value=len([m for m in plan.planned_meals if m.recipe_id is not None]),
                    status="unmet",
                    discrepancy=0.0,
                    is_permitted_exception=False,
                    explanation="Due to active dietary exclusions, an eligible recipe shortage occurred.",
                    suggestion="Due to strict dietary exclusions, an eligible recipe shortage occurred. Please replace incomplete slots with suitable recipes.",
                )
            )

        # Mandatory Acceptance Criteria:
        # - 0 Target Constraints: full success
        # - 1 Target Constraint: permitted exception, clearly identified
        # - >1 Target Constraints: generation must NOT report success (marked as "best_effort")
        nutrition_violations = [u for u in all_unmet_constraints if u.nutrient in ("Calories", "Protein", "Carbohydrates", "Fat")]
        constraint_count = len(nutrition_violations)
        if constraint_count == 0 and not has_placeholders:
            plan_status = "success"
            is_successful = True
            permitted_exception_count = 0
            final_constraints = [u for u in all_unmet_constraints if u not in nutrition_violations]
        elif constraint_count == 1 and not has_placeholders:
            plan_status = "success"
            is_successful = True
            permitted_exception_count = 1
            nutrition_violations[0].is_permitted_exception = True
            nutrition_violations[0].status = "permitted_exception"
            final_constraints = all_unmet_constraints
        else:
            plan_status = "best_effort"
            is_successful = False
            permitted_exception_count = 0
            final_constraints = all_unmet_constraints

        # Quantifiable Strategy Metrics
        unique_recipe_ids = set()
        total_meal_count = 0
        total_cooking_time = 0
        for m in plan.planned_meals:
            if m.recipe_id:
                unique_recipe_ids.add(m.recipe_id)
                total_meal_count += 1
                if m.recipe:
                    total_cooking_time += (m.recipe.prep_time_minutes or 0) + (m.recipe.cook_time_minutes or 0)

        unique_ingredients = set()
        total_items_count = 0
        for pm in plan.planned_meals:
            for item in pm.items:
                if item.food_id:
                    unique_ingredients.add(item.food_id)
                    total_items_count += 1

        shopping_list_count = db.query(ShoppingListItem).filter(ShoppingListItem.meal_plan_id == plan.id).count()

        repetition_rate = round((total_meal_count - len(unique_recipe_ids)) / max(1, total_meal_count), 2)
        reuse_score = round(total_items_count / max(1, len(unique_ingredients)), 2)
        target_compliance_rate = round(max(0.0, (28 - constraint_count) / 28.0), 3)

        strat_metrics = StrategyMetricsResponse(
            unique_ingredients_count=len(unique_ingredients),
            unique_recipes_count=len(unique_recipe_ids),
            meal_repetition_rate=repetition_rate,
            ingredient_reuse_score=reuse_score,
            total_cooking_time_minutes=total_cooking_time,
            shopping_list_item_count=shopping_list_count,
            target_compliance_rate=target_compliance_rate,
        )

        overview = WeeklyNutritionOverview(
            average_daily_calories=avg_cal,
            average_daily_protein=avg_p,
            average_daily_carbs=avg_c,
            average_daily_fat=avg_f,
            average_daily_fiber=avg_fib,
            target_calories=t_cal,
            target_protein=t_p,
            target_carbs=t_c,
            target_fat=t_f,
            target_fiber=t_fib,
            plan_status=plan_status,
            is_successful=is_successful,
            constraint_count=constraint_count,
            permitted_exception_count=permitted_exception_count,
            strategy_metrics=strat_metrics,
            tolerance_pct=plan.target_tolerance_pct,
            adherence_calories_pct=adh_cal,
            adherence_protein_pct=adh_p,
            adherence_carbs_pct=adh_c,
            adherence_fat_pct=adh_f,
            adherence_fiber_pct=adh_fib,
            unmet_constraints=final_constraints,
        )

        return MealPlanResponse(
            id=plan.id,
            user_profile_id=plan.user_profile_id,
            name=plan.name,
            start_date=plan.start_date,
            end_date=plan.end_date,
            is_active=plan.is_active,
            target_tolerance_pct=plan.target_tolerance_pct,
            notes=plan.notes,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
            days=days_resp,
            weekly_overview=overview,
        )

    def replace_planned_meal(
        self, db: Session, planned_meal_id: int, new_recipe_id: int, servings: Optional[float] = None
    ) -> Optional[PlannedMeal]:
        meal = db.query(PlannedMeal).filter(PlannedMeal.id == planned_meal_id).first()
        if not meal:
            return None
        recipe = recipe_repository.get_by_id(db, new_recipe_id)
        if not recipe:
            return None

        plan = meal.meal_plan
        user_profile_id = plan.user_profile_id if plan else None

        if user_profile_id:
            disliked_ids, disliked_terms = self.get_all_disliked_filters(db, user_profile_id)
            if self.is_recipe_disliked(recipe, disliked_ids, disliked_terms):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign recipe '{recipe.name}' because it contains disliked ingredients.",
                )

        other_meals = (
            db.query(PlannedMeal)
            .filter(
                PlannedMeal.meal_plan_id == meal.meal_plan_id,
                PlannedMeal.recipe_id == new_recipe_id,
                PlannedMeal.id != meal.id,
            )
            .all()
        )
        for om in other_meals:
            if om.day_number == meal.day_number:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign this recipe: it is already scheduled in {om.meal_category} on Day {meal.day_number}.",
                )
            if abs(meal.day_number - om.day_number) < 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign this recipe: it is already scheduled on Day {om.day_number}. Spacing rule requires at least 2 complete calendar days separation (|{meal.day_number} - {om.day_number}| < 3).",
                )
        max_allowed = 3 if (plan and plan.notes and ("relaxed" in plan.notes.lower() or "repetition limit was relaxed" in plan.notes.lower())) else 2
        if len(other_meals) >= max_allowed:
            times_str = "twice" if len(other_meals) == 2 else f"{len(other_meals)} times"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot assign this recipe: it already appears {times_str} in this weekly plan (maximum is {max_allowed}).",
            )

        db.query(PlannedMealItem).filter(PlannedMealItem.planned_meal_id == planned_meal_id).delete()

        serv_mult = servings or meal.servings or 1.0
        if serv_mult == 1.5:
            serv_mult = 1.0

        meal.recipe_id = recipe.id
        meal.name = recipe.name
        meal.servings = round(serv_mult, 1)

        recipe_base_servings = recipe.servings if recipe.servings > 0 else 1.0
        effective_ratio = serv_mult / recipe_base_servings

        m_cal = 0.0
        m_p = 0.0
        m_c = 0.0
        m_f = 0.0
        m_fib = 0.0

        for ing in recipe.ingredients:
            rounded_qty = round_portion_quantity(ing.quantity * effective_ratio, ing.unit)
            food = ing.food
            if food:
                scaled = scale_food_nutrients(
                    calories_kcal=food.calories_kcal,
                    protein_g=food.protein_g,
                    carbs_g=food.carbs_g,
                    fat_g=food.fat_g,
                    quantity=rounded_qty,
                    nutritional_basis=food.nutritional_basis,
                    unit=ing.unit,
                    fiber_g=food.fiber_g,
                    serving_quantity=food.serving_quantity,
                )
                i_cal = scaled["calories_kcal"] or 0.0
                i_p = scaled["protein_g"] or 0.0
                i_c = scaled["carbs_g"] or 0.0
                i_f = scaled["fat_g"] or 0.0
                i_fib = scaled["fiber_g"]

                m_cal += i_cal
                m_p += i_p
                m_c += i_c
                m_f += i_f
                if i_fib is not None:
                    m_fib += i_fib

                item = PlannedMealItem(
                    planned_meal_id=meal.id,
                    food_id=food.id,
                    quantity=rounded_qty,
                    unit=ing.unit,
                    calories_kcal=round(i_cal, 1),
                    protein_g=round(i_p, 1),
                    carbs_g=round(i_c, 1),
                    fat_g=round(i_f, 1),
                    fiber_g=round(i_fib, 1) if i_fib is not None else None,
                )
                db.add(item)

        meal.calories_kcal = round(m_cal, 1)
        meal.protein_g = round(m_p, 1)
        meal.carbs_g = round(m_c, 1)
        meal.fat_g = round(m_f, 1)
        meal.fiber_g = round(m_fib, 1)
        meal.notes = f"Target: ~{int(round(m_cal))} kcal"

        self.regenerate_shopping_list(db, meal.meal_plan_id)
        db.commit()
        db.refresh(meal)
        return meal

    def adjust_planned_meal_servings(
        self, db: Session, planned_meal_id: int, new_servings: float
    ) -> Optional[PlannedMeal]:
        meal = db.query(PlannedMeal).filter(PlannedMeal.id == planned_meal_id).first()
        if not meal or new_servings <= 0:
            return None

        if new_servings == 1.5:
            new_servings = 1.0

        ratio = new_servings / (meal.servings if meal.servings > 0 else 1.0)
        meal.servings = round(new_servings, 1)

        m_cal = 0.0
        m_p = 0.0
        m_c = 0.0
        m_f = 0.0
        m_fib = 0.0

        for item in meal.items:
            new_qty = round_portion_quantity(item.quantity * ratio, item.unit)
            item.quantity = new_qty

            food = item.food
            if food:
                scaled = scale_food_nutrients(
                    calories_kcal=food.calories_kcal,
                    protein_g=food.protein_g,
                    carbs_g=food.carbs_g,
                    fat_g=food.fat_g,
                    quantity=new_qty,
                    nutritional_basis=food.nutritional_basis,
                    unit=item.unit,
                    fiber_g=food.fiber_g,
                    serving_quantity=food.serving_quantity,
                )
                item.calories_kcal = round(scaled["calories_kcal"] or 0.0, 1)
                item.protein_g = round(scaled["protein_g"] or 0.0, 1)
                item.carbs_g = round(scaled["carbs_g"] or 0.0, 1)
                item.fat_g = round(scaled["fat_g"] or 0.0, 1)
                item.fiber_g = round(scaled["fiber_g"], 1) if scaled["fiber_g"] is not None else None
            else:
                item.calories_kcal = round(item.calories_kcal * ratio, 1)
                item.protein_g = round(item.protein_g * ratio, 1)
                item.carbs_g = round(item.carbs_g * ratio, 1)
                item.fat_g = round(item.fat_g * ratio, 1)

            m_cal += item.calories_kcal
            m_p += item.protein_g
            m_c += item.carbs_g
            m_f += item.fat_g
            if item.fiber_g is not None:
                m_fib += item.fiber_g

        meal.calories_kcal = round(m_cal, 1)
        meal.protein_g = round(m_p, 1)
        meal.carbs_g = round(m_c, 1)
        meal.fat_g = round(m_f, 1)
        meal.fiber_g = round(m_fib, 1)

        self.regenerate_shopping_list(db, meal.meal_plan_id)
        db.commit()
        db.refresh(meal)
        return meal

    def regenerate_planned_meal(
        self, db: Session, planned_meal_id: int, user_profile_id: Optional[int] = None
    ) -> Optional[PlannedMeal]:
        meal = db.query(PlannedMeal).filter(PlannedMeal.id == planned_meal_id).first()
        if not meal:
            return None

        plan = meal.meal_plan
        if user_profile_id is None:
            user_profile_id = plan.user_profile_id if plan else None
        if not user_profile_id:
            return meal

        disliked_ids, disliked_terms = self.get_all_disliked_filters(db, user_profile_id)
        recipes = recipe_repository.get_all(db, user_profile_id=user_profile_id, include_built_in=True)

        other_meals = (
            db.query(PlannedMeal)
            .filter(
                PlannedMeal.meal_plan_id == meal.meal_plan_id,
                PlannedMeal.id != meal.id,
            )
            .all()
        )
        assignments: Dict[int, List[int]] = {}
        for om in other_meals:
            if om.recipe_id:
                assignments.setdefault(om.recipe_id, []).append(om.day_number)

        target_cal = meal.calories_kcal
        if not meal.recipe_id or target_cal <= 0:
            plan = meal.meal_plan
            t_cal, _, _, _, _ = extract_plan_targets(plan.notes if plan else None, None)
            cat_weights = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snacks": 0.15, "snack": 0.15}
            tot_w = sum(cat_weights.get(c, 0.25) for c in ["breakfast", "lunch", "dinner", "snacks"])
            target_cal = (cat_weights.get(meal.meal_category.lower(), 0.25) / tot_w) * t_cal

        eligible = [
            r for r in recipes
            if category_matches(r.meal_category, meal.meal_category)
            and r.id != meal.recipe_id
            and not self.is_recipe_disliked(r, disliked_ids, disliked_terms)
            and check_recipe_repetition_and_spacing(r.id, meal.day_number, assignments)[0]
        ]

        if not eligible:
            eligible = [
                r for r in recipes
                if is_cross_category_suitable(r, meal.meal_category)
                and r.id != meal.recipe_id
                and not self.is_recipe_disliked(r, disliked_ids, disliked_terms)
                and check_recipe_repetition_and_spacing(r.id, meal.day_number, assignments, max_occurrences=2)[0]
            ]

        if not eligible:
            all_cands = [
                r for r in recipes
                if is_cross_category_suitable(r, meal.meal_category)
                and not self.is_recipe_disliked(r, disliked_ids, disliked_terms)
            ]
            for r in all_cands:
                if r.id == meal.recipe_id:
                    continue
                days = assignments.get(r.id, [])
                if len(days) < 3 and all(abs(meal.day_number - d) >= 3 for d in days):
                    eligible.append(r)

        if not eligible:
            foods = db.query(Food).all()
            food_map = {f.external_id: f for f in foods if f.external_id}
            if food_map:
                cand_generator = CandidateMealGenerator(food_map)
                plan = meal.meal_plan
                t_cal, t_p, t_c, t_f, _ = extract_plan_targets(plan.notes if plan else None, None)
                cat_weights = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snacks": 0.15, "snack": 0.15}
                tot_w = sum(cat_weights.get(c, 0.25) for c in ["breakfast", "lunch", "dinner", "snacks"])
                c_targets = {meal.meal_category.lower(): (cat_weights.get(meal.meal_category.lower(), 0.25) / tot_w) * t_cal}
                dynamic_cands = cand_generator.generate_candidates(
                    cats=[meal.meal_category.lower()],
                    cat_targets=c_targets,
                    disliked_ids=disliked_ids,
                    disliked_terms=disliked_terms,
                    target_calories=t_cal,
                    target_protein=t_p,
                    target_carbs=t_c,
                    target_fat=t_f,
                    simplicity_preference="simple",
                    start_id=10000,
                )
                for dc in dynamic_cands:
                    existing = db.query(Recipe).filter(Recipe.name == dc.name).first()
                    if existing:
                        eligible.append(existing)
                    else:
                        new_rec = Recipe(
                            user_profile_id=None,
                            name=dc.name,
                            meal_category=dc.meal_category,
                            servings=1,
                            prep_time_minutes=dc.prep_time_minutes,
                            cook_time_minutes=dc.cook_time_minutes,
                            instructions="Combine ingredients and prepare as indicated.",
                            tags=dc.tags,
                            is_built_in=True,
                        )
                        db.add(new_rec)
                        db.flush()
                        for ing in dc.ingredients:
                            db_ing = RecipeIngredient(
                                recipe_id=new_rec.id,
                                food_id=ing.food_id,
                                quantity=ing.quantity,
                                unit=ing.unit,
                            )
                            db.add(db_ing)
                        db.flush()
                        eligible.append(new_rec)

        if not eligible:
            return meal

        unused = [r for r in eligible if len(assignments.get(r.id, [])) == 0]
        pool = unused if unused else eligible

        scored = []
        for r in pool:
            nutr = recipe_service.compute_recipe_nutrition(r)
            per_cal = nutr["per_serving_calories"] or target_cal
            serv_mult = 2.0 if per_cal > 0 and (target_cal / per_cal) >= 1.35 else 1.0
            cand_cal = per_cal * serv_mult
            diff = abs(cand_cal - target_cal)
            used_cnt = len(assignments.get(r.id, []))
            scored.append((diff + 10.0 * used_cnt, r.id, r, serv_mult))

        scored.sort(key=lambda x: (x[0], x[1]))
        best_recipe = scored[0][2]
        best_serv = scored[0][3]

        return self.replace_planned_meal(db, planned_meal_id, best_recipe.id, servings=best_serv)

    def dislike_ingredient_and_regenerate(
        self,
        db: Session,
        user_profile_id: int,
        food_name: str,
        food_id: Optional[int] = None,
    ) -> DislikeIngredientResponse:
        disliked_resp = self.add_disliked_food(
            db, user_profile_id, food_name=food_name, food_id=food_id
        )

        plan = self.get_active_plan(db, user_profile_id)
        if not plan:
            return DislikeIngredientResponse(
                disliked_food=disliked_resp,
                affected_meals_count=0,
                regenerated_meals_count=0,
                failed_meals_count=0,
                message=f"Added '{disliked_resp.food_name}' to disliked list. No active meal plan found to regenerate.",
                plan=None,
            )

        disliked_ids, disliked_terms = self.get_all_disliked_filters(db, user_profile_id)

        affected_meals: List[PlannedMeal] = []
        for m in plan.planned_meals:
            is_affected = False
            for it in m.items:
                if it.food_id and it.food_id in disliked_ids:
                    is_affected = True
                    break
                if matches_disliked(it.food.name if it.food else "", disliked_terms):
                    is_affected = True
                    break
            if not is_affected and m.recipe:
                if self.is_recipe_disliked(m.recipe, disliked_ids, disliked_terms):
                    is_affected = True

            if is_affected:
                affected_meals.append(m)

        regenerated_count = 0
        failed_count = 0

        for m in affected_meals:
            old_recipe_id = m.recipe_id
            updated = self.regenerate_planned_meal(db, m.id)
            if updated and updated.recipe_id is not None and updated.recipe_id != old_recipe_id:
                regenerated_count += 1
            else:
                db.query(PlannedMealItem).filter(PlannedMealItem.planned_meal_id == m.id).delete()
                m.recipe_id = None
                m.name = f"Incomplete {m.meal_category.capitalize()} Slot (Disliked Ingredient Removed)"
                m.servings = 1.0
                m.calories_kcal = 0.0
                m.protein_g = 0.0
                m.carbs_g = 0.0
                m.fat_g = 0.0
                m.fiber_g = 0.0
                m.notes = "Ingredient was disliked. Please replace with an alternative recipe."
                db.flush()
                failed_count += 1

        self.regenerate_shopping_list(db, plan.id)
        db.commit()
        db.refresh(plan)

        msg = (
            f"Added '{disliked_resp.food_name}' to disliked foods. "
            f"Found {len(affected_meals)} affected meal(s): {regenerated_count} successfully replaced with alternatives, "
            f"{failed_count} could not be automatically replaced and were cleared for manual selection."
        )

        plan_resp = self.to_response(db, plan, user_profile_id)
        return DislikeIngredientResponse(
            disliked_food=disliked_resp,
            affected_meals_count=len(affected_meals),
            regenerated_meals_count=regenerated_count,
            failed_meals_count=failed_count,
            message=msg,
            plan=plan_resp,
        )

    def log_planned_meals(
        self, db: Session, user_profile_id: int, req: LogPlannedMealRequest
    ) -> LogPlannedMealResponse:
        meals_to_log: List[PlannedMeal] = []
        if req.planned_meal_id:
            pm = db.query(PlannedMeal).filter(PlannedMeal.id == req.planned_meal_id).first()
            if not pm:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Planned meal with id {req.planned_meal_id} not found.",
                )
            if pm.recipe_id is None:
                return LogPlannedMealResponse(
                    success=False,
                    logged_count=0,
                    skipped_count=1,
                    message="Cannot log incomplete meal slot without a recipe.",
                    logged_items=[],
                )
            meals_to_log.append(pm)
        elif req.day_number:
            plan = self.get_active_plan(db, user_profile_id)
            if not plan:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No active meal plan found to log from.",
                )
            meals_to_log = [
                m for m in plan.planned_meals
                if m.day_number == req.day_number and m.recipe_id is not None
            ]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either planned_meal_id or day_number must be provided to log meals.",
            )

        logged_items: List[LoggedItemSummary] = []
        skipped_count = 0
        total_logged = 0

        for pm in meals_to_log:
            # Skip placeholder incomplete meals
            if pm.recipe_id is None:
                skipped_count += 1
                continue

            cat = pm.meal_category.lower()
            if cat not in ("breakfast", "lunch", "dinner", "snack", "snacks"):
                cat = "snack"
            if cat == "snacks":
                cat = "snack"

            for item in pm.items:
                if not item.food_id:
                    continue

                if req.skip_if_already_logged:
                    existing = (
                        db.query(MealLog)
                        .filter(
                            MealLog.user_profile_id == user_profile_id,
                            MealLog.logged_date == req.target_date,
                            MealLog.meal_category == cat,
                            MealLog.food_id == item.food_id,
                        )
                        .first()
                    )
                    if existing:
                        skipped_count += 1
                        continue

                log_entry = MealLogCreate(
                    logged_date=req.target_date,
                    meal_category=cat,
                    food_id=item.food_id,
                    quantity=item.quantity,
                    unit=item.unit,
                    notes=f"Logged from plan: {pm.name}",
                )
                created_log = meal_log_service.create_meal_log(db, log_entry)
                total_logged += 1
                logged_items.append(
                    LoggedItemSummary(
                        food_name=item.food.name if item.food else "Item",
                        quantity=item.quantity,
                        unit=item.unit,
                        meal_log_id=created_log.id,
                    )
                )

        msg = f"Successfully logged {total_logged} item(s) to food diary for {req.target_date}."
        if skipped_count > 0:
            msg += f" Skipped {skipped_count} item(s) already logged."

        return LogPlannedMealResponse(
            success=True,
            logged_count=total_logged,
            skipped_count=skipped_count,
            message=msg,
            logged_items=logged_items,
        )

    def delete_plan(self, db: Session, meal_plan_id: int) -> bool:
        plan = db.query(MealPlan).filter(MealPlan.id == meal_plan_id).first()
        if not plan:
            return False
        db.delete(plan)
        db.commit()
        return True


meal_planner_service = MealPlannerService()
