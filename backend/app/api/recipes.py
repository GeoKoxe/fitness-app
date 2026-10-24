from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.recipe import Recipe
from app.repositories.profile_repository import profile_repository
from app.schemas.recipe import (
    RecipeCreate,
    RecipeResponse,
    RecipeSummaryResponse,
    RecipeUpdate,
)
from app.services.recipe_service import recipe_service

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("", response_model=List[RecipeSummaryResponse])
def get_recipes(
    category: Optional[str] = Query(None, description="Filter by meal category"),
    search: Optional[str] = Query(None, description="Search by name, description, tags"),
    db: Session = Depends(get_db),
):
    profile = profile_repository.get_current_profile(db)
    profile_id = profile.id if profile else None
    return recipe_service.list_recipes(
        db, user_profile_id=profile_id, meal_category=category, search=search
    )


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = recipe_service.get_recipe(db, recipe_id)
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe with id {recipe_id} not found.",
        )
    return recipe


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(recipe_in: RecipeCreate, db: Session = Depends(get_db)):
    profile = profile_repository.get_current_profile(db)
    profile_id = profile.id if profile else None
    return recipe_service.create_recipe(db, recipe_in, user_profile_id=profile_id)


@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: int, recipe_in: RecipeUpdate, db: Session = Depends(get_db)
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe with id {recipe_id} not found.",
        )
    if recipe.is_built_in:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Built-in recipes cannot be modified. Create a custom recipe instead.",
        )
    return recipe_service.update_recipe(db, recipe, recipe_in)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe with id {recipe_id} not found.",
        )
    if recipe.is_built_in:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Built-in recipes cannot be deleted.",
        )
    recipe_service.delete_recipe(db, recipe)
    return None

