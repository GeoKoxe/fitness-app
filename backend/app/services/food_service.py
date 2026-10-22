import logging
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.food import Food
from app.repositories.food_repository import food_repository
from app.schemas.food import (
    FoodCreate,
    FoodListResponse,
    FoodResponse,
    FoodSearchResult,
    FoodUpdate,
)
from app.services.open_food_facts_service import open_food_facts_service

logger = logging.getLogger(__name__)


class FoodService:
    def create_food(self, db: Session, food_in: FoodCreate) -> Food:
        # Check if external food or barcode already exists locally
        if food_in.barcode:
            existing = food_repository.get_by_barcode(db, food_in.barcode)
            if existing:
                return existing
        if food_in.external_id:
            existing = food_repository.get_by_external_id(db, food_in.external_id)
            if existing:
                return existing

        return food_repository.create(db, food_in)

    def get_food(self, db: Session, food_id: int) -> Food:
        food = food_repository.get_by_id(db, food_id)
        if not food:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Food with id {food_id} not found.",
            )
        return food

    def update_food(
        self, db: Session, food_id: int, food_in: FoodUpdate
    ) -> Food:
        food = self.get_food(db, food_id)
        return food_repository.update(db, food, food_in)

    def delete_food(self, db: Session, food_id: int) -> None:
        food = self.get_food(db, food_id)
        food_repository.delete(db, food)

    def toggle_favorite(self, db: Session, food_id: int) -> Food:
        food = self.get_food(db, food_id)
        return food_repository.toggle_favorite(db, food)

    def list_foods(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        favorites_only: bool = False,
        category: Optional[str] = None,
    ) -> FoodListResponse:
        skip = (page - 1) * page_size
        items = food_repository.list_foods(
            db, skip=skip, limit=page_size, favorites_only=favorites_only, category=category
        )
        total = food_repository.count_foods(
            db, favorites_only=favorites_only, category=category
        )
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0

        return FoodListResponse(
            items=[FoodResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def search_foods(
        self,
        db: Session,
        query: str,
        include_external: bool = True,
        limit: int = 20,
    ) -> List[FoodSearchResult]:
        q = query.strip()
        if not q:
            return []

        # 1. Search local database
        local_foods = food_repository.search_foods(db, query=q, limit=limit)
        results: List[FoodSearchResult] = []
        known_barcodes = set()
        known_external_ids = set()

        for f in local_foods:
            if f.barcode:
                known_barcodes.add(f.barcode)
            if f.external_id:
                known_external_ids.add(f.external_id)
            results.append(FoodSearchResult.model_validate(f))

        # 2. Query external provider (Open Food Facts) if requested
        if include_external and len(results) < limit:
            ext_limit = limit - len(results)
            try:
                ext_results = open_food_facts_service.search_foods(q, limit=ext_limit)
                for ext in ext_results:
                    # Deduplicate against local matches
                    if ext.barcode and ext.barcode in known_barcodes:
                        continue
                    if ext.external_id and ext.external_id in known_external_ids:
                        continue
                    results.append(FoodSearchResult(**ext.model_dump()))
            except Exception as e:
                logger.warning("Open Food Facts search failed gracefully for '%s': %s", q, e)

        return results


food_service = FoodService()

