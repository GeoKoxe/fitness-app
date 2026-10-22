from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.food import (
    FoodCreate,
    FoodListResponse,
    FoodResponse,
    FoodSearchResult,
    FoodUpdate,
)
from app.services.food_service import food_service

router = APIRouter(prefix="/foods", tags=["Foods"])


@router.post(
    "",
    response_model=FoodResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom food or save an external food locally",
)
def create_food(
    food_in: FoodCreate, db: Session = Depends(get_db)
) -> FoodResponse:
    food = food_service.create_food(db, food_in)
    return FoodResponse.model_validate(food)


@router.get(
    "",
    response_model=FoodListResponse,
    summary="List saved foods in catalogue",
)
def list_foods(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    favorites_only: bool = Query(False, description="Filter favorites only"),
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db),
) -> FoodListResponse:
    return food_service.list_foods(
        db, page=page, page_size=page_size, favorites_only=favorites_only, category=category
    )


@router.get(
    "/search",
    response_model=List[FoodSearchResult],
    summary="Search foods across local catalogue and Open Food Facts",
)
def search_foods(
    q: str = Query(..., min_length=1, description="Search terms or barcode"),
    include_external: bool = Query(True, description="Query Open Food Facts"),
    limit: int = Query(20, ge=1, le=50, description="Max results"),
    db: Session = Depends(get_db),
) -> List[FoodSearchResult]:
    return food_service.search_foods(
        db, query=q, include_external=include_external, limit=limit
    )


@router.get(
    "/{food_id}",
    response_model=FoodResponse,
    summary="Get food details by ID",
)
def get_food(food_id: int, db: Session = Depends(get_db)) -> FoodResponse:
    food = food_service.get_food(db, food_id)
    return FoodResponse.model_validate(food)


@router.patch(
    "/{food_id}",
    response_model=FoodResponse,
    summary="Update food information",
)
def update_food(
    food_id: int, food_in: FoodUpdate, db: Session = Depends(get_db)
) -> FoodResponse:
    food = food_service.update_food(db, food_id, food_in)
    return FoodResponse.model_validate(food)


@router.delete(
    "/{food_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a food from the catalogue (preserves historical logs)",
)
def delete_food(food_id: int, db: Session = Depends(get_db)) -> None:
    food_service.delete_food(db, food_id)


@router.post(
    "/{food_id}/toggle-favorite",
    response_model=FoodResponse,
    summary="Toggle food favorite status",
)
def toggle_favorite(
    food_id: int, db: Session = Depends(get_db)
) -> FoodResponse:
    food = food_service.toggle_favorite(db, food_id)
    return FoodResponse.model_validate(food)

