from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.domain.nutrition import scale_food_nutrients
from app.models.recipe import Recipe, RecipeIngredient
from app.repositories.food_repository import food_repository
from app.repositories.recipe_repository import recipe_repository
from app.schemas.recipe import (
    RecipeCreate,
    RecipeIngredientResponse,
    RecipeResponse,
    RecipeSummaryResponse,
    RecipeUpdate,
)


class RecipeService:
    def compute_recipe_nutrition(self, recipe: Recipe) -> Dict[str, Any]:
        """Compute aggregated and per-serving nutrition from linked foods."""
        total_cal = 0.0
        total_p = 0.0
        total_c = 0.0
        total_f = 0.0
        total_fib = 0.0
        has_fib = False

        ingredient_responses: List[RecipeIngredientResponse] = []

        for ing in recipe.ingredients:
            food = ing.food
            if food:
                scaled = scale_food_nutrients(
                    calories_kcal=food.calories_kcal,
                    protein_g=food.protein_g,
                    carbs_g=food.carbs_g,
                    fat_g=food.fat_g,
                    quantity=ing.quantity,
                    nutritional_basis=food.nutritional_basis,
                    unit=ing.unit,
                    fiber_g=food.fiber_g,
                    serving_quantity=food.serving_quantity,
                )
                ing_cal = scaled["calories_kcal"] or 0.0
                ing_p = scaled["protein_g"] or 0.0
                ing_c = scaled["carbs_g"] or 0.0
                ing_f = scaled["fat_g"] or 0.0
                ing_fib = scaled["fiber_g"]

                total_cal += ing_cal
                total_p += ing_p
                total_c += ing_c
                total_f += ing_f
                if ing_fib is not None:
                    total_fib += ing_fib
                    has_fib = True

                ingredient_responses.append(
                    RecipeIngredientResponse(
                        id=ing.id,
                        food_id=food.id,
                        food_name=food.name,
                        food_category=food.category,
                        quantity=ing.quantity,
                        unit=ing.unit,
                        preparation_notes=ing.preparation_notes,
                        calories_kcal=round(ing_cal, 1),
                        protein_g=round(ing_p, 1),
                        carbs_g=round(ing_c, 1),
                        fat_g=round(ing_f, 1),
                        fiber_g=round(ing_fib, 1) if ing_fib is not None else None,
                    )
                )
            else:
                ingredient_responses.append(
                    RecipeIngredientResponse(
                        id=ing.id,
                        food_id=ing.food_id,
                        quantity=ing.quantity,
                        unit=ing.unit,
                        preparation_notes=ing.preparation_notes,
                    )
                )

        servings = recipe.servings if recipe.servings > 0 else 1
        per_cal = total_cal / servings
        per_p = total_p / servings
        per_c = total_c / servings
        per_f = total_f / servings
        per_fib = (total_fib / servings) if has_fib else 0.0

        return {
            "ingredients": ingredient_responses,
            "total_calories": round(total_cal, 1),
            "total_protein": round(total_p, 1),
            "total_carbs": round(total_c, 1),
            "total_fat": round(total_f, 1),
            "total_fiber": round(total_fib, 1),
            "per_serving_calories": round(per_cal, 1),
            "per_serving_protein": round(per_p, 1),
            "per_serving_carbs": round(per_c, 1),
            "per_serving_fat": round(per_f, 1),
            "per_serving_fiber": round(per_fib, 1),
        }

    def to_response(self, recipe: Recipe) -> RecipeResponse:
        nutr = self.compute_recipe_nutrition(recipe)
        return RecipeResponse(
            id=recipe.id,
            user_profile_id=recipe.user_profile_id,
            name=recipe.name,
            description=recipe.description,
            meal_category=recipe.meal_category,
            servings=recipe.servings,
            prep_time_minutes=recipe.prep_time_minutes,
            cook_time_minutes=recipe.cook_time_minutes,
            instructions=recipe.instructions,
            tags=recipe.tags,
            is_built_in=recipe.is_built_in,
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
            ingredients=nutr["ingredients"],
            total_calories=nutr["total_calories"],
            total_protein=nutr["total_protein"],
            total_carbs=nutr["total_carbs"],
            total_fat=nutr["total_fat"],
            total_fiber=nutr["total_fiber"],
            per_serving_calories=nutr["per_serving_calories"],
            per_serving_protein=nutr["per_serving_protein"],
            per_serving_carbs=nutr["per_serving_carbs"],
            per_serving_fat=nutr["per_serving_fat"],
            per_serving_fiber=nutr["per_serving_fiber"],
        )

    def to_summary(self, recipe: Recipe) -> RecipeSummaryResponse:
        nutr = self.compute_recipe_nutrition(recipe)
        return RecipeSummaryResponse(
            id=recipe.id,
            user_profile_id=recipe.user_profile_id,
            name=recipe.name,
            description=recipe.description,
            meal_category=recipe.meal_category,
            servings=recipe.servings,
            prep_time_minutes=recipe.prep_time_minutes,
            cook_time_minutes=recipe.cook_time_minutes,
            instructions=recipe.instructions,
            tags=recipe.tags,
            is_built_in=recipe.is_built_in,
            ingredients_count=len(recipe.ingredients),
            per_serving_calories=nutr["per_serving_calories"],
            per_serving_protein=nutr["per_serving_protein"],
            per_serving_carbs=nutr["per_serving_carbs"],
            per_serving_fat=nutr["per_serving_fat"],
            per_serving_fiber=nutr["per_serving_fiber"],
        )

    def list_recipes(
        self,
        db: Session,
        user_profile_id: Optional[int] = None,
        meal_category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[RecipeSummaryResponse]:
        recipes = recipe_repository.get_all(
            db,
            user_profile_id=user_profile_id,
            include_built_in=True,
            meal_category=meal_category,
            search=search,
        )
        return [self.to_summary(r) for r in recipes]

    def get_recipe(self, db: Session, recipe_id: int) -> Optional[RecipeResponse]:
        recipe = recipe_repository.get_by_id(db, recipe_id)
        if not recipe:
            return None
        return self.to_response(recipe)

    def create_recipe(
        self, db: Session, recipe_in: RecipeCreate, user_profile_id: Optional[int] = None
    ) -> RecipeResponse:
        recipe = Recipe(
            user_profile_id=user_profile_id,
            name=recipe_in.name.strip(),
            description=recipe_in.description,
            meal_category=recipe_in.meal_category,
            servings=recipe_in.servings,
            prep_time_minutes=recipe_in.prep_time_minutes,
            cook_time_minutes=recipe_in.cook_time_minutes,
            instructions=recipe_in.instructions,
            tags=recipe_in.tags,
            is_built_in=False,
        )
        for ing in recipe_in.ingredients:
            recipe.ingredients.append(
                RecipeIngredient(
                    food_id=ing.food_id,
                    quantity=ing.quantity,
                    unit=ing.unit,
                    preparation_notes=ing.preparation_notes,
                )
            )
        recipe = recipe_repository.create(db, recipe)
        return self.to_response(recipe)

    def update_recipe(
        self, db: Session, recipe: Recipe, recipe_in: RecipeUpdate
    ) -> RecipeResponse:
        if recipe_in.name is not None:
            recipe.name = recipe_in.name.strip()
        if recipe_in.description is not None:
            recipe.description = recipe_in.description
        if recipe_in.meal_category is not None:
            recipe.meal_category = recipe_in.meal_category
        if recipe_in.servings is not None:
            recipe.servings = recipe_in.servings
        if recipe_in.prep_time_minutes is not None:
            recipe.prep_time_minutes = recipe_in.prep_time_minutes
        if recipe_in.cook_time_minutes is not None:
            recipe.cook_time_minutes = recipe_in.cook_time_minutes
        if recipe_in.instructions is not None:
            recipe.instructions = recipe_in.instructions
        if recipe_in.tags is not None:
            recipe.tags = recipe_in.tags

        if recipe_in.ingredients is not None:
            recipe.ingredients.clear()
            for ing in recipe_in.ingredients:
                recipe.ingredients.append(
                    RecipeIngredient(
                        recipe_id=recipe.id,
                        food_id=ing.food_id,
                        quantity=ing.quantity,
                        unit=ing.unit,
                        preparation_notes=ing.preparation_notes,
                    )
                )

        db.commit()
        db.refresh(recipe)
        return self.to_response(recipe)

    def delete_recipe(self, db: Session, recipe: Recipe) -> None:
        recipe_repository.delete(db, recipe)


recipe_service = RecipeService()

