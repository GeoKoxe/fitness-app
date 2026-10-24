from typing import List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.recipe import Recipe, RecipeIngredient


class RecipeRepository:
    def get_all(
        self,
        db: Session,
        user_profile_id: Optional[int] = None,
        include_built_in: bool = True,
        meal_category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Recipe]:
        query = db.query(Recipe).options(
            joinedload(Recipe.ingredients).joinedload(RecipeIngredient.food)
        )

        filters = []
        if user_profile_id is not None:
            if include_built_in:
                filters.append(or_(Recipe.user_profile_id == user_profile_id, Recipe.is_built_in.is_(True)))
            else:
                filters.append(Recipe.user_profile_id == user_profile_id)
        elif include_built_in:
            filters.append(Recipe.is_built_in.is_(True))

        if filters:
            query = query.filter(*filters)

        if meal_category and meal_category != "all":
            query = query.filter(or_(Recipe.meal_category == meal_category, Recipe.meal_category == "any"))

        if search:
            search_term = f"%{search.strip().lower()}%"
            query = query.filter(
                or_(
                    Recipe.name.ilike(search_term),
                    Recipe.description.ilike(search_term),
                    Recipe.tags.ilike(search_term),
                )
            )

        return query.order_by(Recipe.name.asc()).all()

    def get_by_id(self, db: Session, recipe_id: int) -> Optional[Recipe]:
        return (
            db.query(Recipe)
            .options(joinedload(Recipe.ingredients).joinedload(RecipeIngredient.food))
            .filter(Recipe.id == recipe_id)
            .first()
        )

    def create(self, db: Session, recipe: Recipe) -> Recipe:
        db.add(recipe)
        db.commit()
        db.refresh(recipe)
        return recipe

    def delete(self, db: Session, recipe: Recipe) -> None:
        db.delete(recipe)
        db.commit()


recipe_repository = RecipeRepository()

