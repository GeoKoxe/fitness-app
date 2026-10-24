"""Idempotent seeder for built-in recipes catalogue."""

import logging
from sqlalchemy.orm import Session

from app.data.built_in_recipes import BUILT_IN_RECIPES
from app.models.recipe import Recipe, RecipeIngredient
from app.repositories.food_repository import food_repository

logger = logging.getLogger(__name__)


def seed_built_in_recipes(db: Session) -> int:
    """Seed built-in recipes into the database if not already present.

    Idempotent:
    - Checks for existing Recipe with matching name and is_built_in=True.
    - Resolves ingredients against generic foods via external_id.
    - Never overwrites custom user recipes.

    Returns:
        int: Number of new recipe records inserted.
    """
    inserted = 0

    for recipe_data in BUILT_IN_RECIPES:
        name = recipe_data["name"]
        existing = db.query(Recipe).filter(Recipe.name == name, Recipe.is_built_in.is_(True)).first()
        if existing is not None:
            continue

        tags_val = recipe_data.get("tags", [])
        if isinstance(tags_val, list):
            tags_str = ",".join(tags_val)
        else:
            tags_str = str(tags_val or "")

        recipe = Recipe(
            name=name,
            description=recipe_data.get("description"),
            meal_category=recipe_data.get("category", "any"),
            prep_time_minutes=recipe_data.get("prep_time_minutes", 5),
            cook_time_minutes=recipe_data.get("cook_time_minutes", 0),
            servings=recipe_data.get("servings", 1),
            instructions=recipe_data.get("instructions"),
            tags=tags_str,
            is_built_in=True,
        )
        db.add(recipe)
        db.flush()  # assign recipe.id

        for ing in recipe_data.get("ingredients", []):
            ext_id = ing.get("food_external_id")
            food = food_repository.get_by_external_id(db, ext_id)
            if food is None:
                logger.warning(
                    "Seed recipes: Food with external_id '%s' not found for recipe '%s'. Skipping ingredient.",
                    ext_id,
                    name,
                )
                continue

            ingredient = RecipeIngredient(
                recipe_id=recipe.id,
                food_id=food.id,
                quantity=float(ing["quantity"]),
                unit=ing.get("unit", "g"),
                preparation_notes=ing.get("preparation_state"),
            )
            db.add(ingredient)

        inserted += 1

    if inserted > 0:
        db.commit()
        logger.info("Seeded %d built-in recipes.", inserted)
    else:
        logger.debug("Built-in recipes already seeded. 0 items added.")

    return inserted


if __name__ == "__main__":
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        count = seed_built_in_recipes(db)
        print(f"Seeded {count} built-in recipes successfully.")
    finally:
        db.close()

