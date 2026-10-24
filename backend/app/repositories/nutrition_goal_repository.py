from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.nutrition_goal import NutritionGoal
from app.schemas.nutrition_goal import NutritionGoalUpdate


class NutritionGoalRepository:
    def get_by_profile_id(
        self, db: Session, user_profile_id: int
    ) -> Optional[NutritionGoal]:
        stmt = (
            select(NutritionGoal)
            .where(NutritionGoal.user_profile_id == user_profile_id)
            .limit(1)
        )
        return db.scalars(stmt).first()

    def save_or_update(
        self, db: Session, user_profile_id: int, goal_in: NutritionGoalUpdate
    ) -> NutritionGoal:
        goal = self.get_by_profile_id(db, user_profile_id)
        update_data = goal_in.model_dump(exclude_unset=True)

        if not goal:
            goal = NutritionGoal(user_profile_id=user_profile_id, **update_data)
            db.add(goal)
        else:
            for field, value in update_data.items():
                setattr(goal, field, value)

        db.commit()
        db.refresh(goal)
        return goal


nutrition_goal_repository = NutritionGoalRepository()

