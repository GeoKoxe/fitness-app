import datetime
import itertools
import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.domain.nutrition import round_portion_quantity, scale_food_nutrients, validate_portion_quantity
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
from app.models.profile import UserProfile
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
    UnmetConstraintDetail,
    WeeklyNutritionOverview,
)
from app.services.meal_log_service import meal_log_service
from app.services.recipe_service import recipe_service


def matches_disliked(text: str, disliked_terms: List[str]) -> bool:
    """Check if text contains any disliked term using strict word boundaries.

    Guarantees that excluding 'olives' will NOT exclude 'olive oil'.
    """
    if not text or not disliked_terms:
        return False
    text_lower = text.lower()
    for term in disliked_terms:
        clean = term.strip().lower()
        if not clean:
            continue
        # Use \b word boundaries
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
    """Check if a recipe from another category is genuinely appropriate for target_category under Level 2 relaxation."""
    if not recipe or not recipe.meal_category:
        return True
    rcat = recipe.meal_category.lower().strip()
    tcat = target_category.lower().strip()
    if category_matches(rcat, tcat):
        return True

    # Lunch and Dinner are interchangeable main hot/savory meals
    if tcat in ("lunch", "dinner") and rcat in ("lunch", "dinner"):
        return True

    # Wholesome breakfast-suitable items: yogurt bowls, toasts, oat bowls, porridges, chia snacks
    if tcat == "breakfast" and rcat in ("snack", "snacks"):
        rname = recipe.name.lower()
        if any(term in rname for term in ("toast", "yogurt", "oat", "porridge", "bowl", "chia", "apple & peanut butter")):
            return True
        return False

    # Light breakfast items suitable for snacks
    if tcat in ("snack", "snacks") and rcat == "breakfast":
        rname = recipe.name.lower()
        if any(term in rname for term in ("toast", "bowl", "porridge", "oats", "chia")):
            return True
        return False

    return False


def check_recipe_repetition_and_spacing(
    recipe_id: int,
    target_day: int,
    assignments: Dict[int, List[int]],
) -> Tuple[bool, str]:
    """Validate Phase 6 mandatory repetition and spacing rules:
    1. A particular recipe ID may appear at most twice in the same weekly plan.
    2. If a recipe appears twice, its occurrences must be separated by at least 2 complete calendar days:
       abs(target_day - other_day) >= 3.
       - Monday (1) and Thursday (4): allowed (abs(1 - 4) = 3 >= 3).
       - Monday (1) and Wednesday (3): not allowed (abs(1 - 3) = 2 < 3).
       - Monday (1) and Tuesday (2): not allowed (abs(1 - 2) = 1 < 3).
    3. Same recipe cannot appear on the same day in different categories:
       abs(target_day - target_day) = 0 < 3 -> not allowed.
    """
    days = assignments.get(recipe_id, [])
    if len(days) >= 2:
        return False, f"Recipe already appears {len(days)} times in this weekly plan (maximum is 2)."
    for d in days:
        if abs(target_day - d) < 3:
            return (
                False,
                f"Recipe already scheduled on Day {d}. Spacing rule requires at least 2 complete calendar days separation (|{target_day} - {d}| < 3).",
            )
    return True, ""


def check_target_compatibility(
    target_calories: float,
    target_protein: Optional[float],
    target_carbs: Optional[float],
    target_fat: Optional[float],
    tolerance_pct: float = 10.0,
) -> Tuple[bool, Optional[str], float]:
    """Check whether calories and macronutrient targets are mathematically compatible.

    Using the standard energy relationship:
    calories ≈ 4 * protein_g + 4 * carbohydrates_g + 9 * fat_g

    Returns (is_compatible, conflict_message, expected_calories).
    """
    if not target_protein or not target_carbs or not target_fat:
        return True, None, target_calories

    if target_protein <= 0 or target_carbs <= 0 or target_fat <= 0 or target_calories <= 0:
        return True, None, target_calories

    expected_cal = 4.0 * target_protein + 4.0 * target_carbs + 9.0 * target_fat
    diff_cal = abs(expected_cal - target_calories)
    diff_pct = (diff_cal / target_calories) * 100.0

    tol_factor = tolerance_pct / 100.0
    min_macro_cal = expected_cal * (1.0 - tol_factor)
    max_macro_cal = expected_cal * (1.0 + tol_factor)
    min_target_cal = target_calories * (1.0 - tol_factor)
    max_target_cal = target_calories * (1.0 + tol_factor)

    if min_macro_cal > max_target_cal or max_macro_cal < min_target_cal or diff_pct > (tolerance_pct * 1.5):
        msg = (
            f"Configured macronutrient targets ({int(round(target_protein))}g protein, "
            f"{int(round(target_carbs))}g carbs, {int(round(target_fat))}g fat) provide approximately "
            f"{int(round(expected_cal))} kcal (via 4/4/9 kcal/g energy conversion). This deviates by "
            f"{diff_pct:.1f}% from your daily calorie target of {int(round(target_calories))} kcal, "
            f"exceeding your ±{tolerance_pct:.0f}% tolerance. All configured goals cannot be satisfied simultaneously."
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

            items_data.append({
                "food_id": food.id,
                "quantity": rounded_qty,
                "unit": ing.unit,
                "calories_kcal": round(i_cal, 1),
                "protein_g": round(i_p, 1),
                "carbs_g": round(i_c, 1),
                "fat_g": round(i_f, 1),
                "fiber_g": round(i_fib, 1) if i_fib is not None else None,
            })

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
        # Find existing
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

        # Resolve food if not given
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

        # Also sync preference string
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
            .filter(DislikedFood.id == disliked_id, DislikedFood.user_profile_id == user_profile_id)
            .first()
        )
        if not item:
            return False

        food_name = item.food_name
        db.delete(item)

        # Also remove from preference string
        pref = self.get_or_create_preferences(db, user_profile_id)
        current_list = [s.strip() for s in pref.disliked_foods.split(",") if s.strip()]
        new_list = [s for s in current_list if s.lower() != food_name.lower()]
        pref.disliked_foods = ",".join(new_list)

        db.commit()
        return True

    def get_all_disliked_filters(
        self, db: Session, user_profile_id: int, extra_terms: Optional[List[str]] = None
    ) -> Tuple[Set[int], List[str]]:
        """Collect all active disliked food IDs and string keywords for a user profile."""
        disliked_records = (
            db.query(DislikedFood).filter(DislikedFood.user_profile_id == user_profile_id).all()
        )
        ids: Set[int] = {r.food_id for r in disliked_records if r.food_id is not None}
        terms: List[str] = [r.food_name.strip() for r in disliked_records if r.food_name.strip()]

        pref = (
            db.query(MealPlannerPreferences)
            .filter(MealPlannerPreferences.user_profile_id == user_profile_id)
            .first()
        )
        if pref and pref.disliked_foods:
            for s in pref.disliked_foods.split(","):
                clean = s.strip()
                if clean and clean.lower() not in [t.lower() for t in terms]:
                    terms.append(clean)

        if extra_terms:
            for s in extra_terms:
                clean = s.strip()
                if clean and clean.lower() not in [t.lower() for t in terms]:
                    terms.append(clean)

        return ids, terms

    def is_recipe_disliked(
        self, recipe: Recipe, disliked_ids: Set[int], disliked_terms: List[str]
    ) -> bool:
        """Check if recipe name, instructions, or any ingredient matches disliked filters."""
        if matches_disliked(recipe.name, disliked_terms) or matches_disliked(
            recipe.instructions or "", disliked_terms
        ):
            return True

        for ing in recipe.ingredients:
            if ing.food_id in disliked_ids:
                return True
            food_name = ing.food.name if ing.food else ""
            if matches_disliked(food_name, disliked_terms):
                return True

        return False

    def get_active_plan(
        self, db: Session, user_profile_id: int
    ) -> Optional[MealPlan]:
        return (
            db.query(MealPlan)
            .filter(MealPlan.user_profile_id == user_profile_id, MealPlan.is_active.is_(True))
            .order_by(MealPlan.id.desc())
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
                # Level 2: Cross category suitable recipes
                opts_l2 = get_category_options(c, level=2)
                r_ids_l2 = list(set(opt[0] for opt in opts_l2 if opt[0] is not None))
                if len(r_ids_l2) >= 4:
                    cat_level[c] = 2
                    cat_opts[c] = opts_l2
                    max_repeats[c] = 2
                    warnings.append(
                        f"Due to dietary exclusions, suitable cross-category recipes were included for {c} to complete your plan without violating variety rules."
                    )
                elif len(r_ids_l2) >= 3:
                    # Level 3: 3 recipes can fill 7 days with max_repeat=3 and spacing >= 3
                    cat_level[c] = 3
                    cat_opts[c] = opts_l2
                    max_repeats[c] = 3
                    warnings.append(
                        f"Strict dietary exclusions left only {len(r_ids_l2)} eligible recipes for {c}. Repetition limit was relaxed to 3 occurrences with spacing >= 3 days to guarantee a complete weekly plan."
                    )
                elif len(r_ids_l2) > 0:
                    # Level 4: Infeasible for all 7 days, fill as many as possible
                    cat_level[c] = 4
                    cat_opts[c] = opts_l2
                    max_repeats[c] = 2
                    warnings.append(
                        f"Only {len(r_ids_l2)} eligible recipe(s) available for {c} under active dietary preferences. At least 3 recipes are required to fill 7 days under spacing rules. Incomplete slot(s) left for user selection."
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

        for c in sorted_cats:
            tc = cat_targets.get(c, 500.0)
            cands = list(cat_opts[c])

            # Deterministic candidate base cost
            def cand_base_cost(opt: Tuple[Optional[int], float]) -> Tuple[float, int]:
                if opt[0] is None:
                    return (1e6, 0)
                c_diff = abs(precomputed[opt]["calories_kcal"] - tc) / max(1.0, tc)
                overlap = 0
                if reuse_ingredients and simplicity_preference == "simple":
                    rec = precomputed[opt]["recipe"]
                    if rec:
                        overlap = sum(1 for ing in rec.ingredients if ing.food_id)
                return (c_diff - 0.02 * overlap, opt[0])

            m_rep = max_repeats[c]
            seq: List[Optional[Tuple[Optional[int], float]]] = [None] * 7
            local_assign: Dict[int, int] = {}

            def backtrack_category_days(day: int) -> bool:
                if day > 7:
                    return True
                # Dynamically order candidates: unused recipes first, then closest calories, then ID
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
                    # Spacing within current category
                    spacing_ok = True
                    for prev_d in range(1, day):
                        prev_opt = seq[prev_d - 1]
                        if prev_opt and prev_opt[0] == rid and abs(day - prev_d) < 3:
                            spacing_ok = False
                            break
                    if not spacing_ok:
                        continue
                    # Spacing against other categories
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
                # If complete assignment is mathematically impossible (e.g. Level 4), fill as many slots as possible
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

        # Solution dictionary mapping (day, cat) -> opt
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

        def score_combo(combo: List[Tuple[Optional[int], float]]) -> float:
            cal, p, cb, f, _ = calc_nutr(combo)
            err_cal = (cal - target_calories) / max(1.0, target_calories)
            err_p = (p - target_protein) / max(1.0, target_protein)
            err_c = (cb - target_carbs) / max(1.0, target_carbs)
            err_f = (f - target_fat) / max(1.0, target_fat)

            pen_cal = 250.0 * max(0.0, abs(cal - target_calories) / max(1.0, target_calories) - tol_f) ** 2
            pen_p = 150.0 * max(0.0, abs(p - target_protein) / max(1.0, target_protein) - tol_f) ** 2
            pen_c = 80.0 * max(0.0, abs(cb - target_carbs) / max(1.0, target_carbs) - tol_f) ** 2
            pen_f = 80.0 * max(0.0, abs(f - target_fat) / max(1.0, target_fat) - tol_f) ** 2

            loss = 0.40 * (err_cal ** 2) + 0.30 * (err_p ** 2) + 0.15 * (err_c ** 2) + 0.15 * (err_f ** 2)
            return loss + pen_cal + pen_p + pen_c + pen_f

        for _ in range(25):
            improved = False
            for day in range(1, 8):
                combo = [solution[(day, c)] for c in cats]
                if any(opt[0] is None for opt in combo):
                    continue
                cal, p, cb, f, _ = calc_nutr(combo)
                if (abs(cal - target_calories) / target_calories <= tol_f and
                    abs(p - target_protein) / target_protein <= tol_f and
                    abs(cb - target_carbs) / target_carbs <= tol_f and
                    abs(f - target_fat) / target_fat <= tol_f):
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
                        if len(weekly_assignments.get(cand_rid, [])) >= m_rep:
                            continue
                        if cand_rid in day_forbidden[day]:
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
        """Deterministic 2-stage weekly nutrition optimization 7-day meal plan generator."""
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

        # Selected tolerance (10.0 to 15.0)
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

        # 7. Run 2-Stage Weekly Nutrition Optimization
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

        for day_num in range(1, 8):
            cur_date = start_date + datetime.timedelta(days=day_num - 1)
            for cat in cats:
                target_meal_cal = cat_targets.get(cat, 500.0)
                selected_recipe, servings_multiplier, nutr_dict = optimized_days[day_num][cat]

                if selected_recipe:
                    meal_name = selected_recipe.name
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
                    servings=servings_multiplier,
                    calories_kcal=nutr_dict["calories_kcal"],
                    protein_g=nutr_dict["protein_g"],
                    carbs_g=nutr_dict["carbs_g"],
                    fat_g=nutr_dict["fat_g"],
                    fiber_g=nutr_dict["fiber_g"],
                    notes=notes_str,
                )
                db.add(planned_meal)
                db.flush()

                for item_data in nutr_dict.get("items", []):
                    item = PlannedMealItem(
                        planned_meal_id=planned_meal.id,
                        food_id=item_data["food_id"],
                        quantity=item_data["quantity"],
                        unit=item_data["unit"],
                        calories_kcal=item_data["calories_kcal"],
                        protein_g=item_data["protein_g"],
                        carbs_g=item_data["carbs_g"],
                        fat_g=item_data["fat_g"],
                        fiber_g=item_data["fiber_g"],
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
        """Aggregate all ingredients across the 7-day plan into ShoppingListItem records."""
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

            key = (it.food_id, it.unit.lower())
            if key not in aggregated:
                aggregated[key] = {
                    "food_id": food.id,
                    "ingredient_name": food.name,
                    "category": food.category or "Other",
                    "total_quantity": 0.0,
                    "unit": it.unit,
                }
            aggregated[key]["total_quantity"] += it.quantity

        for agg in aggregated.values():
            sli = ShoppingListItem(
                meal_plan_id=meal_plan_id,
                food_id=agg["food_id"],
                ingredient_name=agg["ingredient_name"],
                category=agg["category"],
                total_quantity=round(agg["total_quantity"], 1),
                unit=agg["unit"],
                is_checked=False,
                is_excluded=False,
            )
            db.add(sli)

    def to_response(
        self, db: Session, plan: MealPlan, user_profile_id: int
    ) -> MealPlanResponse:
        """Convert a MealPlan model into a complete structured MealPlanResponse with tolerance evaluation."""
        target = (
            db.query(NutritionGoal)
            .filter(NutritionGoal.user_profile_id == user_profile_id)
            .first()
        )
        t_cal, t_p, t_c, t_f, t_fib = extract_plan_targets(plan.notes, target)

        # Tolerance evaluation: source of truth is the plan's saved tolerance, with preference fallback
        if getattr(plan, "target_tolerance_pct", None) is not None:
            tol_pct = float(plan.target_tolerance_pct)
        else:
            pref = self.get_or_create_preferences(db, user_profile_id)
            tol_pct = float(pref.target_tolerance_pct) if pref.target_tolerance_pct else 10.0
        tol_factor = tol_pct / 100.0

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

        # Feature G: Evaluate constraints and tolerances
        unmet: List[UnmetConstraintDetail] = []

        # Target mathematical compatibility check
        is_compat, compat_msg, expected_cal = check_target_compatibility(
            target_calories=t_cal,
            target_protein=t_p,
            target_carbs=t_c,
            target_fat=t_f,
            tolerance_pct=tol_pct,
        )
        if not is_compat and compat_msg:
            unmet.append(
                UnmetConstraintDetail(
                    target_name="Target Compatibility",
                    target_value=t_cal,
                    actual_value=round(expected_cal, 1),
                    tolerance_pct=tol_pct,
                    upper_limit=round(t_cal * (1.0 + tol_factor), 1),
                    status="conflict",
                    suggestion=compat_msg,
                )
            )

        def check_target(name: str, actual: float, target_val: Optional[float], unit_str: str):
            if not target_val or target_val <= 0:
                return
            upper = target_val * (1.0 + tol_factor)
            lower = target_val * (1.0 - tol_factor)
            if actual > upper:
                unmet.append(
                    UnmetConstraintDetail(
                        target_name=name,
                        target_value=target_val,
                        actual_value=actual,
                        tolerance_pct=tol_pct,
                        upper_limit=round(upper, 1),
                        status="exceeded",
                        suggestion=f"Planned {name.lower()} ({actual} {unit_str}) exceed upper limit ({round(upper, 1)} {unit_str}). Consider lighter meal options or reducing portions.",
                    )
                )
            elif actual < lower:
                unmet.append(
                    UnmetConstraintDetail(
                        target_name=name,
                        target_value=target_val,
                        actual_value=actual,
                        tolerance_pct=tol_pct,
                        upper_limit=round(upper, 1),
                        status="under",
                        suggestion=f"Planned {name.lower()} ({actual} {unit_str}) are below lower limit ({round(lower, 1)} {unit_str}). Consider adding an extra snack or denser staple portions.",
                    )
                )

        check_target("Calories", avg_cal, t_cal, "kcal")
        check_target("Protein", avg_p, t_p, "g")
        check_target("Carbohydrates", avg_c, t_c, "g")
        check_target("Fat", avg_f, t_f, "g")
        check_target("Fiber", avg_fib, t_fib, "g")

        # Check daily calorie balance across all 7 days
        day_deviations = []
        for d in days_resp:
            has_placeholder = any(m.recipe_id is None for m in d.meals)
            if not has_placeholder and t_cal > 0:
                dev_pct = ((d.total_calories - t_cal) / t_cal) * 100.0
                if abs(dev_pct) > tol_pct:
                    day_deviations.append(
                        f"Day {d.day_number} ({d.day_name}: {d.total_calories:.0f} kcal, {dev_pct:+.1f}%)"
                    )
        if day_deviations:
            unmet.append(
                UnmetConstraintDetail(
                    target_name="Daily Calorie Balance",
                    target_value=t_cal,
                    actual_value=avg_cal,
                    tolerance_pct=tol_pct,
                    upper_limit=round(t_cal * (1.0 + tol_factor), 1),
                    status="under" if any("-" in x.split("kcal,")[1] for x in day_deviations) else "exceeded",
                    suggestion=f"Daily calories deviate beyond ±{tol_pct:.0f}% tolerance on: {'; '.join(day_deviations)}. Consider adjusting individual meal choices.",
                )
            )

        # Phase 6: Check recipe variety constraints
        missing_recipes = [m for d in days_resp for m in d.meals if m.recipe_id is None]
        if missing_recipes:
            slots_desc = ", ".join(f"Day {m.day_number} {m.meal_category}" for m in missing_recipes[:3])
            if len(missing_recipes) > 3:
                slots_desc += f" and {len(missing_recipes) - 3} more"
            total_slots = sum(len(d.meals) for d in days_resp)
            unmet.append(
                UnmetConstraintDetail(
                    target_name="Recipe Variety",
                    target_value=float(total_slots),
                    actual_value=float(total_slots - len(missing_recipes)),
                    tolerance_pct=0.0,
                    upper_limit=float(total_slots),
                    status="conflict",
                    suggestion=f"Catalogue shortage: {len(missing_recipes)} slot(s) ({slots_desc}) could not be filled with a distinct recipe without violating spacing (≥2 days) or repetition rules. Slot(s) left incomplete without fabricated nutrition. Use 'Replace' to choose or create recipes, or reduce dietary filters.",
                )
            )

        # Surface plan advisories (Level 2 cross-category adaptation or Level 3 repetition relaxation)
        if plan.notes and "[Advisories:" in plan.notes:
            adv_match = re.search(r"\[Advisories:\s*(.*?)\]", plan.notes)
            if adv_match:
                adv_text = adv_match.group(1)
                total_slots = sum(len(d.meals) for d in days_resp)
                for part in adv_text.split(";"):
                    clean_part = part.strip()
                    if clean_part:
                        is_conflict = "infeasible" in clean_part.lower() or "incomplete" in clean_part.lower() or "no eligible" in clean_part.lower()
                        unmet.append(
                            UnmetConstraintDetail(
                                target_name="Dietary Feasibility" if is_conflict else "Variety Adjustment",
                                target_value=float(total_slots),
                                actual_value=float(total_slots - len(missing_recipes)),
                                tolerance_pct=0.0,
                                upper_limit=float(total_slots),
                                status="conflict" if is_conflict else "relaxed",
                                suggestion=clean_part,
                            )
                        )

        weekly_overview = WeeklyNutritionOverview(
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
            tolerance_pct=tol_pct,
            adherence_calories_pct=adh_cal,
            adherence_protein_pct=adh_p,
            adherence_carbs_pct=adh_c,
            adherence_fat_pct=adh_f,
            adherence_fiber_pct=adh_fib,
            unmet_constraints=unmet,
        )

        return MealPlanResponse(
            id=plan.id,
            user_profile_id=plan.user_profile_id,
            name=plan.name,
            start_date=plan.start_date,
            end_date=plan.end_date,
            is_active=plan.is_active,
            target_tolerance_pct=tol_pct,
            notes=plan.notes,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
            days=days_resp,
            weekly_overview=weekly_overview,
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

        # Mandatory Disliked Food Exclusion Safeguard (Section 3: Never introduce a disliked ingredient)
        if user_profile_id:
            disliked_ids, disliked_terms = self.get_all_disliked_filters(db, user_profile_id)
            if self.is_recipe_disliked(recipe, disliked_ids, disliked_terms):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign recipe '{recipe.name}' because it contains disliked ingredients.",
                )

        # Repetition & Spacing Validation
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

        # Clear existing items
        db.query(PlannedMealItem).filter(PlannedMealItem.planned_meal_id == planned_meal_id).delete()

        # Reject 1.5x serving option explicitly (Feature E)
        serv_mult = servings or meal.servings or 1.0
        if serv_mult == 1.5:
            serv_mult = 1.0

        meal.recipe_id = recipe.id
        meal.name = recipe.name
        meal.servings = serv_mult

        recipe_base_servings = recipe.servings if recipe.servings > 0 else 1
        effective_ratio = serv_mult / recipe_base_servings

        m_cal = 0.0
        m_p = 0.0
        m_c = 0.0
        m_f = 0.0
        m_fib = 0.0

        for ing in recipe.ingredients:
            # Enforce portion increments of 5 for weight/volume, whole counts for counts
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

        # Feature E: Remove 1.5x serving option
        if new_servings == 1.5:
            new_servings = 1.0

        ratio = new_servings / (meal.servings if meal.servings > 0 else 1.0)
        meal.servings = new_servings

        m_cal = 0.0
        m_p = 0.0
        m_c = 0.0
        m_f = 0.0
        m_fib = 0.0

        for item in meal.items:
            # Enforce portion increments of 5 for weight/volume, whole counts for counts
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
        self, db: Session, planned_meal_id: int, user_profile_id: int
    ) -> Optional[PlannedMeal]:
        meal = db.query(PlannedMeal).filter(PlannedMeal.id == planned_meal_id).first()
        if not meal:
            return None

        disliked_ids, disliked_terms = self.get_all_disliked_filters(db, user_profile_id)

        # Collect current assignments of all other meals in the plan
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

        recipes = recipe_repository.get_all(
            db, user_profile_id=user_profile_id, include_built_in=True
        )

        # Correct Target Resolution (Section 5: Do not use 0-calorie placeholder value as target)
        target_cal = meal.calories_kcal
        if not meal.recipe_id or target_cal <= 0:
            plan = meal.meal_plan
            t_cal, _, _, _, _ = extract_plan_targets(plan.notes if plan else None, None)
            cat_weights = {"breakfast": 0.25, "lunch": 0.35, "dinner": 0.35, "snacks": 0.15, "snack": 0.15}
            tot_w = sum(cat_weights.get(c, 0.25) for c in ["breakfast", "lunch", "dinner", "snacks"])
            target_cal = (cat_weights.get(meal.meal_category.lower(), 0.25) / tot_w) * t_cal

        # Relaxation Hierarchy: Level 1 -> Level 2 -> Level 3
        # Level 1: Native category with repetition <= 2 and spacing >= 3
        cat_candidates = [
            r for r in recipes
            if category_matches(r.meal_category, meal.meal_category)
            and not self.is_recipe_disliked(r, disliked_ids, disliked_terms)
        ]
        eligible = []
        for r in cat_candidates:
            if r.id == meal.recipe_id:
                continue
            ok, _ = check_recipe_repetition_and_spacing(r.id, meal.day_number, assignments)
            if ok:
                eligible.append(r)

        # Level 2: Cross category suitable recipes
        if not eligible:
            cross_cands = [
                r for r in recipes
                if is_cross_category_suitable(r, meal.meal_category)
                and not self.is_recipe_disliked(r, disliked_ids, disliked_terms)
            ]
            for r in cross_cands:
                if r.id == meal.recipe_id:
                    continue
                ok, _ = check_recipe_repetition_and_spacing(r.id, meal.day_number, assignments)
                if ok:
                    eligible.append(r)

        # Level 3: Controlled repetition relaxation (allow up to 3 occurrences with spacing >= 3)
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
            return meal

        # Rule 3: Prefer unused recipes
        unused = [r for r in eligible if len(assignments.get(r.id, [])) == 0]
        pool = unused if unused else eligible

        # Rank by closeness to meal calories
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
        """Mark an ingredient as disliked and regenerate ONLY the affected meals.

        Guarantees:
        - Food is added to persistent disliked-food list.
        - Only affected planned meals are regenerated; all other meals and days are preserved.
        - Replacements aim within ±25 kcal of the original meal when feasible.
        - Portion quantities respect Feature D (multiples of 5 for weight/volume).
        - Shopping list is updated to reflect replacements.
        - If replacement fails, original meal is kept intact and failure is reported.
        """
        # 1. Persist disliked food
        disliked_resp = self.add_disliked_food(
            db, user_profile_id, food_name=food_name, food_id=food_id
        )

        # 2. Get active plan
        plan = self.get_active_plan(db, user_profile_id)
        if not plan:
            return DislikeIngredientResponse(
                disliked_food=disliked_resp,
                affected_meals_count=0,
                regenerated_meals_count=0,
                failed_meals_count=0,
                message=f"Added '{disliked_resp.food_name}' to disliked list. No active meal plan found.",
                plan=None,
            )

        # 3. Find only planned meals containing the disliked food
        affected_meals: List[PlannedMeal] = []
        for pm in plan.planned_meals:
            is_affected = False
            for it in pm.items:
                it_name = it.food.name if it.food else ""
                if (disliked_resp.food_id and it.food_id == disliked_resp.food_id) or matches_disliked(
                    it_name, [disliked_resp.food_name]
                ):
                    is_affected = True
                    break
            if not is_affected and matches_disliked(pm.name, [disliked_resp.food_name]):
                is_affected = True

            if is_affected:
                affected_meals.append(pm)

        if not affected_meals:
            return DislikeIngredientResponse(
                disliked_food=disliked_resp,
                affected_meals_count=0,
                regenerated_meals_count=0,
                failed_meals_count=0,
                message=f"Added '{disliked_resp.food_name}' to disliked list. None of your currently planned meals contain this ingredient.",
                plan=self.to_response(db, plan, user_profile_id),
            )

        # 4. Fetch all active disliked filters
        disliked_ids, disliked_terms = self.get_all_disliked_filters(db, user_profile_id)

        # 5. Fetch candidate recipes
        all_recipes = recipe_repository.get_all(
            db, user_profile_id=user_profile_id, include_built_in=True
        )
        eligible_recipes = [
            r for r in all_recipes if not self.is_recipe_disliked(r, disliked_ids, disliked_terms)
        ]

        # Collect current assignments of all unaffected meals
        current_assignments: Dict[int, List[int]] = {}
        affected_ids = set(m.id for m in affected_meals)
        for pm in plan.planned_meals:
            if pm.id not in affected_ids and pm.recipe_id:
                current_assignments.setdefault(pm.recipe_id, []).append(pm.day_number)

        regenerated_count = 0
        failed_count = 0
        within_25_count = 0

        # Sort affected meals by day_number
        affected_meals.sort(key=lambda m: (m.day_number, m.id))

        for pm in affected_meals:
            target_cal = pm.calories_kcal
            cat = pm.meal_category.lower().strip()

            cat_candidates = [
                r for r in eligible_recipes
                if category_matches(r.meal_category, cat) and r.id != pm.recipe_id
            ]
            if not cat_candidates:
                cat_candidates = [r for r in eligible_recipes if r.id != pm.recipe_id]

            # Filter candidates by Phase 6 repetition & spacing rules
            eligible_for_pm = []
            for r in cat_candidates:
                ok, _ = check_recipe_repetition_and_spacing(r.id, pm.day_number, current_assignments)
                if ok:
                    eligible_for_pm.append(r)

            if not eligible_for_pm:
                # No valid alternative found without violating rules: retain original meal
                failed_count += 1
                if pm.recipe_id:
                    current_assignments.setdefault(pm.recipe_id, []).append(pm.day_number)
                continue

            # Prefer unused recipes
            unused = [r for r in eligible_for_pm if len(current_assignments.get(r.id, [])) == 0]
            pool = unused if unused else eligible_for_pm

            # Score candidates: prefer closest calories, ideally within ±25 kcal
            scored: List[Tuple[Recipe, float, float]] = []
            for r in pool:
                r_nutr = recipe_service.compute_recipe_nutrition(r)
                per_cal = r_nutr["per_serving_calories"] or target_cal
                # Test with serving = 1.0 (or 2.0 if target > 1.6 * per_cal)
                serv_mult = 2.0 if per_cal > 0 and (target_cal / per_cal) >= 1.6 else 1.0
                cand_cal = per_cal * serv_mult
                diff = abs(cand_cal - target_cal)
                scored.append((r, serv_mult, diff))

            # Sort by: whether within 25 kcal, then absolute calorie diff, then recipe ID
            scored.sort(key=lambda x: (0 if x[2] <= 25.0 else 1, x[2], x[0].id))

            best_recipe, best_serv, best_diff = scored[0]
            if best_diff <= 25.0:
                within_25_count += 1

            # Replace the affected meal
            self.replace_planned_meal(db, pm.id, best_recipe.id, servings=best_serv)
            current_assignments.setdefault(best_recipe.id, []).append(pm.day_number)
            regenerated_count += 1

        # 6. Regenerate shopping list and refresh plan
        self.regenerate_shopping_list(db, plan.id)
        db.commit()
        db.refresh(plan)

        updated_plan_resp = self.to_response(db, plan, user_profile_id)

        # 7. Formulate honest summary message
        msg_parts = [
            f"Added '{disliked_resp.food_name}' to disliked list.",
            f"Found {len(affected_meals)} affected meal(s); successfully replaced {regenerated_count}.",
        ]
        if within_25_count > 0:
            msg_parts.append(f"{within_25_count} replacement(s) matched within ±25 kcal tolerance.")
        if failed_count > 0:
            msg_parts.append(
                f"{failed_count} meal(s) could not be safely replaced due to lack of eligible recipes and were kept intact."
            )

        return DislikeIngredientResponse(
            disliked_food=disliked_resp,
            affected_meals_count=len(affected_meals),
            regenerated_meals_count=regenerated_count,
            failed_meals_count=failed_count,
            message=" ".join(msg_parts),
            plan=updated_plan_resp,
        )

    def log_planned_meals(
        self, db: Session, user_profile_id: int, req: LogPlannedMealRequest
    ) -> LogPlannedMealResponse:
        meals_to_log: List[PlannedMeal] = []

        if req.planned_meal_id:
            m = (
                db.query(PlannedMeal)
                .join(MealPlan, PlannedMeal.meal_plan_id == MealPlan.id)
                .filter(
                    PlannedMeal.id == req.planned_meal_id,
                    MealPlan.user_profile_id == user_profile_id,
                )
                .first()
            )
            if m:
                meals_to_log.append(m)
        elif req.day_number:
            active_plan = self.get_active_plan(db, user_profile_id)
            if active_plan:
                meals = (
                    db.query(PlannedMeal)
                    .filter(
                        PlannedMeal.meal_plan_id == active_plan.id,
                        PlannedMeal.day_number == req.day_number,
                    )
                    .all()
                )
                meals_to_log.extend(meals)

        if not meals_to_log:
            return LogPlannedMealResponse(
                success=False,
                logged_count=0,
                skipped_count=0,
                message="No planned meals found to log.",
                logged_items=[],
            )

        logged_count = 0
        skipped_count = 0
        placeholder_skipped_count = 0
        logged_items_summary: List[LoggedItemSummary] = []

        for pm in meals_to_log:
            cat = pm.meal_category.lower().strip()
            if cat == "snack":
                cat = "snacks"

            # Case A: Planned meal has individual items
            if pm.items:
                for it in pm.items:
                    if not it.food_id:
                        continue
                    # Check for duplicate
                    existing = (
                        db.query(MealLog)
                        .filter(
                            MealLog.user_profile_id == user_profile_id,
                            MealLog.logged_date == req.target_date,
                            MealLog.meal_category == cat,
                            MealLog.food_id == it.food_id,
                        )
                        .first()
                    )
                    if existing and req.skip_if_already_logged:
                        skipped_count += 1
                        continue

                    log_entry = MealLogCreate(
                        logged_date=req.target_date,
                        meal_category=cat,
                        food_id=it.food_id,
                        quantity=it.quantity,
                        unit=it.unit,
                        notes=f"Logged from plan: {pm.name}",
                    )
                    created = meal_log_service.create_meal_log(db, log_entry)
                    logged_count += 1
                    food_name = it.food.name if it.food else "Ingredient"
                    logged_items_summary.append(
                        LoggedItemSummary(
                            food_name=food_name,
                            quantity=it.quantity,
                            unit=it.unit,
                            meal_log_id=created.id,
                        )
                    )
            # Case B: Planned meal has an associated recipe with ingredients
            elif pm.recipe and pm.recipe.ingredients:
                base_servings = pm.recipe.servings if pm.recipe.servings > 0 else 1
                ratio = pm.servings / base_servings
                for ing in pm.recipe.ingredients:
                    if not ing.food_id:
                        continue
                    rounded_qty = round_portion_quantity(ing.quantity * ratio, ing.unit)
                    existing = (
                        db.query(MealLog)
                        .filter(
                            MealLog.user_profile_id == user_profile_id,
                            MealLog.logged_date == req.target_date,
                            MealLog.meal_category == cat,
                            MealLog.food_id == ing.food_id,
                        )
                        .first()
                    )
                    if existing and req.skip_if_already_logged:
                        skipped_count += 1
                        continue

                    log_entry = MealLogCreate(
                        logged_date=req.target_date,
                        meal_category=cat,
                        food_id=ing.food_id,
                        quantity=rounded_qty,
                        unit=ing.unit,
                        notes=f"Logged from recipe: {pm.recipe.name}",
                    )
                    created = meal_log_service.create_meal_log(db, log_entry)
                    logged_count += 1
                    food_name = ing.food.name if ing.food else "Ingredient"
                    logged_items_summary.append(
                        LoggedItemSummary(
                            food_name=food_name,
                            quantity=rounded_qty,
                            unit=ing.unit,
                            meal_log_id=created.id,
                        )
                    )
            # Case C: Planned meal has a direct food_id reference
            elif pm.food_id:
                existing = (
                    db.query(MealLog)
                    .filter(
                        MealLog.user_profile_id == user_profile_id,
                        MealLog.logged_date == req.target_date,
                        MealLog.meal_category == cat,
                        MealLog.food_id == pm.food_id,
                    )
                    .first()
                )
                if existing and req.skip_if_already_logged:
                    skipped_count += 1
                else:
                    food_obj = food_repository.get_by_id(db, pm.food_id)
                    unit = food_obj.serving_unit if food_obj and food_obj.serving_unit else "g"
                    qty = pm.servings * (food_obj.serving_quantity if food_obj and food_obj.serving_quantity else 100.0)
                    log_entry = MealLogCreate(
                        logged_date=req.target_date,
                        meal_category=cat,
                        food_id=pm.food_id,
                        quantity=qty,
                        unit=unit,
                        notes=f"Logged from plan: {pm.name}",
                    )
                    created = meal_log_service.create_meal_log(db, log_entry)
                    logged_count += 1
                    logged_items_summary.append(
                        LoggedItemSummary(
                            food_name=pm.name,
                            quantity=qty,
                            unit=unit,
                            meal_log_id=created.id,
                        )
                    )
            # Case D: Incomplete placeholder slot without recipe or food reference
            elif pm.recipe_id is None and not pm.items and not pm.food_id:
                # Incomplete placeholder slot - skip logging to avoid creating fictitious meal logs
                placeholder_skipped_count += 1
                continue
            # Case E: Custom entry with direct positive nutritional macros
            elif pm.calories_kcal > 0:
                existing = (
                    db.query(MealLog)
                    .filter(
                        MealLog.user_profile_id == user_profile_id,
                        MealLog.logged_date == req.target_date,
                        MealLog.meal_category == cat,
                        MealLog.food_name == pm.name,
                    )
                    .first()
                )
                if existing and req.skip_if_already_logged:
                    skipped_count += 1
                else:
                    log_entry = MealLogCreate(
                        logged_date=req.target_date,
                        meal_category=cat,
                        food_name=pm.name,
                        quantity=1.0,
                        unit="serving",
                        calories_kcal=pm.calories_kcal,
                        protein_g=pm.protein_g,
                        carbs_g=pm.carbs_g,
                        fat_g=pm.fat_g,
                        fiber_g=pm.fiber_g,
                        notes="Logged from plan",
                    )
                    created = meal_log_service.create_meal_log(db, log_entry)
                    logged_count += 1
                    logged_items_summary.append(
                        LoggedItemSummary(
                            food_name=pm.name,
                            quantity=1.0,
                            unit="serving",
                            meal_log_id=created.id,
                        )
                    )

        db.commit()

        if logged_count > 0:
            msg = f"Successfully logged {logged_count} item(s) to Daily Log for {req.target_date}."
            if skipped_count > 0:
                msg += f" Skipped {skipped_count} item(s) already logged."
            if placeholder_skipped_count > 0:
                msg += f" Skipped {placeholder_skipped_count} incomplete slot(s)."
            success = True
        elif skipped_count > 0:
            msg = f"No new items logged. All {skipped_count} item(s) were already logged for {req.target_date}."
            success = True
        elif placeholder_skipped_count > 0:
            msg = "Cannot log incomplete meal slot without a recipe or ingredients. Please assign a recipe first."
            success = False
        else:
            msg = "No loggable items found in the selected meal."
            success = False

        return LogPlannedMealResponse(
            success=success,
            logged_count=logged_count,
            skipped_count=skipped_count + placeholder_skipped_count,
            message=msg,
            logged_items=logged_items_summary,
        )

    def delete_plan(self, db: Session, meal_plan_id: int) -> bool:
        plan = db.query(MealPlan).filter(MealPlan.id == meal_plan_id).first()
        if not plan:
            return False
        db.delete(plan)
        db.commit()
        return True


meal_planner_service = MealPlannerService()
