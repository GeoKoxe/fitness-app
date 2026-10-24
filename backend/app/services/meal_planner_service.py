import datetime
import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple
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

    def generate_plan(
        self, db: Session, user_profile_id: int, req: MealPlanGenerateRequest
    ) -> MealPlan:
        """Deterministic rule-based 7-day meal plan generator respecting portion rules and tolerances."""
        # 1. Resolve Targets
        target = (
            db.query(NutritionGoal)
            .filter(NutritionGoal.user_profile_id == user_profile_id)
            .first()
        )
        t_cal = req.target_calories or (target.calories_kcal if target else 2000.0)
        t_protein = req.target_protein or (target.protein_g if target else 120.0)
        t_carbs = req.target_carbs or (target.carbs_g if target else 225.0)
        t_fat = req.target_fat or (target.fat_g if target else 65.0)
        t_fiber = req.target_fiber or (target.fiber_g if target else 30.0)

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
        }
        total_weight = sum(cat_weights.get(c, 0.25) for c in cats)
        cat_targets = {
            c: (cat_weights.get(c, 0.25) / total_weight) * t_cal for c in cats
        }

        # 4. Persist any disliked foods entered in generate request
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

        # Fetch all updated persistent disliked filters
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

        valid_recipes: List[Tuple[Recipe, Dict[str, Any]]] = []
        for r in all_recipes:
            # Check max cooking time
            total_time = (r.prep_time_minutes or 0) + (r.cook_time_minutes or 0)
            if req.max_cooking_time_minutes and total_time > req.max_cooking_time_minutes:
                continue

            # Check disliked foods
            if self.is_recipe_disliked(r, disliked_ids, disliked_terms):
                continue

            nutr = recipe_service.compute_recipe_nutrition(r)
            valid_recipes.append((r, nutr))

        # 6. Deactivate existing active plans for this profile
        db.query(MealPlan).filter(
            MealPlan.user_profile_id == user_profile_id, MealPlan.is_active.is_(True)
        ).update({"is_active": False})

        # Create new MealPlan
        plan = MealPlan(
            user_profile_id=user_profile_id,
            name=req.name or f"Plan starting {start_date.strftime('%b %d')}",
            start_date=start_date,
            end_date=end_date,
            is_active=True,
            target_tolerance_pct=selected_tol,
            notes=f"Generated with target {int(t_cal)} kcal. Preference: {req.simplicity_preference}.",
        )
        db.add(plan)
        db.flush()

        # 7. Generate 7 Days Deterministically
        used_recipes_per_cat: Dict[str, List[Recipe]] = {c: [] for c in cats}

        for day_idx in range(7):
            cur_date = start_date + datetime.timedelta(days=day_idx)
            day_num = day_idx + 1

            for cat in cats:
                target_meal_cal = cat_targets.get(cat, 500.0)

                candidates = [
                    (r, n)
                    for r, n in valid_recipes
                    if r.meal_category == cat or r.meal_category == "any"
                ]

                if not candidates:
                    candidates = valid_recipes

                selected_recipe: Optional[Recipe] = None
                selected_nutr: Optional[Dict[str, Any]] = None
                servings_multiplier = 1.0

                if candidates:
                    if req.simplicity_preference == "simple":
                        if day_idx % 2 == 1 and used_recipes_per_cat[cat]:
                            selected_recipe = used_recipes_per_cat[cat][-1]
                            selected_nutr = recipe_service.compute_recipe_nutrition(selected_recipe)
                        else:
                            scored = sorted(
                                candidates,
                                key=lambda item: (
                                    abs((item[1]["per_serving_calories"] or 300.0) - target_meal_cal),
                                    item[0].id,
                                ),
                            )
                            pick_idx = (day_idx // 2) % len(scored)
                            selected_recipe, selected_nutr = scored[pick_idx]
                            used_recipes_per_cat[cat].append(selected_recipe)
                    else:
                        scored = sorted(
                            candidates,
                            key=lambda item: (
                                abs((item[1]["per_serving_calories"] or 300.0) - target_meal_cal),
                                item[0].id,
                            ),
                        )
                        pick_idx = day_idx % len(scored)
                        selected_recipe, selected_nutr = scored[pick_idx]

                    # Whole-serving scaling: 1.0 or 2.0 (never 1.5x)
                    per_cal = selected_nutr["per_serving_calories"] or target_meal_cal
                    if per_cal > 0 and (target_meal_cal / per_cal) >= 1.6:
                        servings_multiplier = 2.0
                    else:
                        servings_multiplier = 1.0

                    meal_name = selected_recipe.name
                    recipe_id = selected_recipe.id
                else:
                    meal_name = f"Wholesome {cat.capitalize()} Meal"
                    recipe_id = None
                    servings_multiplier = 1.0

                planned_meal = PlannedMeal(
                    meal_plan_id=plan.id,
                    plan_date=cur_date,
                    day_number=day_num,
                    meal_category=cat,
                    recipe_id=recipe_id,
                    name=meal_name,
                    servings=servings_multiplier,
                    calories_kcal=0.0,
                    protein_g=0.0,
                    carbs_g=0.0,
                    fat_g=0.0,
                    fiber_g=0.0,
                    notes=f"Target: ~{int(target_meal_cal)} kcal",
                )
                db.add(planned_meal)
                db.flush()

                # Calculate item quantities enforcing whole multiples of 5 for weight/volume
                m_cal = 0.0
                m_p = 0.0
                m_c = 0.0
                m_f = 0.0
                m_fib = 0.0

                if selected_recipe:
                    recipe_base_servings = (
                        selected_recipe.servings if selected_recipe.servings > 0 else 1
                    )
                    effective_ratio = servings_multiplier / recipe_base_servings

                    for ing in selected_recipe.ingredients:
                        # Enforce portion increments of 5 for weight/volume, whole counts for counts
                        rounded_qty = round_portion_quantity(
                            ing.quantity * effective_ratio, ing.unit
                        )
                        food = ing.food
                        if food:
                            # Recalculate nutrition using actual rounded portion quantity
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
                                planned_meal_id=planned_meal.id,
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
                else:
                    m_cal = target_meal_cal
                    m_p = (target_meal_cal * 0.25) / 4.0
                    m_c = (target_meal_cal * 0.50) / 4.0
                    m_f = (target_meal_cal * 0.25) / 9.0

                planned_meal.calories_kcal = round(m_cal, 1)
                planned_meal.protein_g = round(m_p, 1)
                planned_meal.carbs_g = round(m_c, 1)
                planned_meal.fat_g = round(m_f, 1)
                planned_meal.fiber_g = round(m_fib, 1)

        # 8. Generate Shopping List Items
        self.regenerate_shopping_list(db, plan.id)

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
        t_cal = target.calories_kcal if target else 2000.0
        t_p = target.protein_g if target else 120.0
        t_c = target.carbs_g if target else 225.0
        t_f = target.fat_g if target else 65.0
        t_fib = target.fiber_g if target else 30.0

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

        recipes = recipe_repository.get_all(
            db, user_profile_id=user_profile_id, include_built_in=True, meal_category=meal.meal_category
        )
        candidates = [
            r for r in recipes
            if r.id != meal.recipe_id and not self.is_recipe_disliked(r, disliked_ids, disliked_terms)
        ]
        if not candidates:
            return meal

        new_recipe = candidates[0]
        return self.replace_planned_meal(db, planned_meal_id, new_recipe.id, meal.servings)

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

        regenerated_count = 0
        failed_count = 0
        within_25_count = 0

        for pm in affected_meals:
            target_cal = pm.calories_kcal
            cat = pm.meal_category.lower().strip()

            cat_candidates = [
                r for r in eligible_recipes
                if (r.meal_category == cat or r.meal_category == "any") and r.id != pm.recipe_id
            ]
            if not cat_candidates:
                cat_candidates = [r for r in eligible_recipes if r.id != pm.recipe_id]

            if not cat_candidates:
                # No valid alternative found: retain original meal, do not corrupt plan
                failed_count += 1
                continue

            # Score candidates: prefer closest calories, ideally within ±25 kcal
            scored: List[Tuple[Recipe, float, float]] = []
            for r in cat_candidates:
                r_nutr = recipe_service.compute_recipe_nutrition(r)
                per_cal = r_nutr["per_serving_calories"] or target_cal
                # Test with serving = 1.0 (or 2.0 if target > 1.6 * per_cal)
                serv_mult = 2.0 if per_cal > 0 and (target_cal / per_cal) >= 1.6 else 1.0
                cand_cal = per_cal * serv_mult
                diff = abs(cand_cal - target_cal)
                scored.append((r, serv_mult, diff))

            # Sort by: whether within 25 kcal, then absolute calorie diff
            scored.sort(key=lambda x: (0 if x[2] <= 25.0 else 1, x[2]))

            best_recipe, best_serv, best_diff = scored[0]
            if best_diff <= 25.0:
                within_25_count += 1

            # Replace the affected meal
            self.replace_planned_meal(db, pm.id, best_recipe.id, servings=best_serv)
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
            # Case D: Custom entry with direct nutritional macros
            else:
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
            success = True
        elif skipped_count > 0:
            msg = f"No new items logged. All {skipped_count} item(s) were already logged for {req.target_date}."
            success = True
        else:
            msg = "No loggable items found in the selected meal."
            success = False

        return LogPlannedMealResponse(
            success=success,
            logged_count=logged_count,
            skipped_count=skipped_count,
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
