from datetime import date
from typing import Any, Dict, List, Optional
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.food import Food
from app.models.meal_log import MealLog


class MealLogRepository:
    def get_by_id(self, db: Session, log_id: int) -> Optional[MealLog]:
        return db.get(MealLog, log_id)

    def list_by_date(
        self, db: Session, user_profile_id: int, target_date: date
    ) -> List[MealLog]:
        stmt = (
            select(MealLog)
            .where(
                MealLog.user_profile_id == user_profile_id,
                MealLog.logged_date == target_date,
            )
            .order_by(MealLog.created_at.asc())
        )
        return list(db.scalars(stmt).all())

    def list_logs(
        self,
        db: Session,
        user_profile_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        meal_category: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[MealLog]:
        stmt = select(MealLog).where(MealLog.user_profile_id == user_profile_id)
        if start_date:
            stmt = stmt.where(MealLog.logged_date >= start_date)
        if end_date:
            stmt = stmt.where(MealLog.logged_date <= end_date)
        if meal_category:
            stmt = stmt.where(MealLog.meal_category == meal_category)

        stmt = (
            stmt.order_by(desc(MealLog.logged_date), MealLog.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    def get_recent_foods(
        self, db: Session, user_profile_id: int, limit: int = 10
    ) -> List[Food]:
        # Distinct food_ids logged recently by this user
        subq = (
            select(MealLog.food_id, func.max(MealLog.created_at).label("latest_log"))
            .where(
                MealLog.user_profile_id == user_profile_id,
                MealLog.food_id.isnot(None),
            )
            .group_by(MealLog.food_id)
            .order_by(desc("latest_log"))
            .limit(limit)
            .subquery()
        )
        stmt = (
            select(Food)
            .join(subq, Food.id == subq.c.food_id)
            .order_by(desc(subq.c.latest_log))
        )
        return list(db.scalars(stmt).all())

    def create(
        self,
        db: Session,
        user_profile_id: int,
        food_id: Optional[int],
        logged_date: date,
        meal_category: str,
        quantity: float,
        unit: str,
        snapshot: Dict[str, Any],
        notes: Optional[str] = None,
    ) -> MealLog:
        db_obj = MealLog(
            user_profile_id=user_profile_id,
            food_id=food_id,
            logged_date=logged_date,
            meal_category=meal_category,
            quantity=quantity,
            unit=unit,
            food_name=snapshot["food_name"],
            food_brand=snapshot.get("food_brand"),
            calories_kcal=snapshot["calories_kcal"],
            protein_g=snapshot["protein_g"],
            carbs_g=snapshot["carbs_g"],
            fat_g=snapshot["fat_g"],
            fiber_g=snapshot.get("fiber_g"),
            sugar_g=snapshot.get("sugar_g"),
            saturated_fat_g=snapshot.get("saturated_fat_g"),
            sodium_mg=snapshot.get("sodium_mg"),
            notes=notes,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, db_obj: MealLog, update_data: Dict[str, Any]
    ) -> MealLog:
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, db_obj: MealLog) -> None:
        db.delete(db_obj)
        db.commit()


meal_log_repository = MealLogRepository()

