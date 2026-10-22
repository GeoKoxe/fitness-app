from typing import Optional
from sqlalchemy import case, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.food import Food
from app.schemas.food import FoodCreate, FoodUpdate


class FoodRepository:
    def get_by_id(self, db: Session, food_id: int) -> Optional[Food]:
        return db.get(Food, food_id)

    def get_by_external_id(self, db: Session, external_id: str) -> Optional[Food]:
        stmt = select(Food).where(Food.external_id == external_id).limit(1)
        return db.scalars(stmt).first()

    def get_by_barcode(self, db: Session, barcode: str) -> Optional[Food]:
        stmt = select(Food).where(Food.barcode == barcode).limit(1)
        return db.scalars(stmt).first()

    def search_foods(
        self,
        db: Session,
        query: str,
        limit: int = 20,
        favorites_only: bool = False,
    ) -> list[Food]:
        raw_q = query.strip()
        q = f"%{raw_q}%"
        stmt = select(Food).where(
            or_(
                Food.name.ilike(q),
                Food.brand.ilike(q),
                Food.barcode.ilike(q),
            )
        )
        if favorites_only:
            stmt = stmt.where(Food.is_favorite.is_(True))

        # Ranking logic:
        # 1. Exact name match (case-insensitive)
        # 2. Name prefix match
        # 3. User favorites
        # 4. Generic USDA foods
        # 5. Alphabetical by name
        exact_match = case((func.lower(Food.name) == raw_q.lower(), 0), else_=1)
        prefix_match = case((Food.name.ilike(f"{raw_q}%"), 0), else_=1)
        generic_match = case((Food.source == "generic_usda", 0), else_=1)

        stmt = stmt.order_by(
            exact_match,
            prefix_match,
            desc(Food.is_favorite),
            generic_match,
            Food.name.asc(),
        ).limit(limit)
        return list(db.scalars(stmt).all())

    def list_foods(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 50,
        favorites_only: bool = False,
        category: Optional[str] = None,
    ) -> list[Food]:
        stmt = select(Food)
        if favorites_only:
            stmt = stmt.where(Food.is_favorite.is_(True))
        if category:
            stmt = stmt.where(Food.category == category)

        stmt = stmt.order_by(desc(Food.is_favorite), Food.name.asc()).offset(skip).limit(limit)
        return list(db.scalars(stmt).all())

    def count_foods(
        self,
        db: Session,
        favorites_only: bool = False,
        category: Optional[str] = None,
    ) -> int:
        stmt = select(func.count()).select_from(Food)
        if favorites_only:
            stmt = stmt.where(Food.is_favorite.is_(True))
        if category:
            stmt = stmt.where(Food.category == category)
        return db.scalar(stmt) or 0

    def create(self, db: Session, food_in: FoodCreate) -> Food:
        food_data = food_in.model_dump()
        db_obj = Food(**food_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Food, food_in: FoodUpdate) -> Food:
        update_data = food_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, db_obj: Food) -> None:
        db.delete(db_obj)
        db.commit()

    def toggle_favorite(self, db: Session, db_obj: Food) -> Food:
        db_obj.is_favorite = not db_obj.is_favorite
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


food_repository = FoodRepository()

