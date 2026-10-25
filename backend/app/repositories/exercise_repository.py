from typing import List, Optional
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.exercise import Exercise


class ExerciseRepository:
    def get_by_id(self, db: Session, exercise_id: int) -> Optional[Exercise]:
        return db.get(Exercise, exercise_id)

    def get_by_slug(self, db: Session, slug: str) -> Optional[Exercise]:
        stmt = select(Exercise).where(Exercise.slug == slug.lower().strip())
        return db.scalars(stmt).first()

    def get_by_name(
        self, db: Session, name: str, user_profile_id: Optional[int] = None
    ) -> Optional[Exercise]:
        clean = name.strip()
        conditions = [Exercise.name.ilike(clean)]
        if user_profile_id is not None:
            conditions.append(
                or_(Exercise.user_profile_id == user_profile_id, Exercise.is_built_in.is_(True))
            )
        stmt = select(Exercise).where(*conditions)
        return db.scalars(stmt).first()

    def list_exercises(
        self,
        db: Session,
        user_profile_id: Optional[int] = None,
        q: Optional[str] = None,
        primary_muscle: Optional[str] = None,
        equipment: Optional[str] = None,
        movement_category: Optional[str] = None,
        difficulty: Optional[str] = None,
        include_built_in: bool = True,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Exercise]:
        stmt = select(Exercise)

        # Profile scoping: user custom exercises + built-in
        if user_profile_id is not None:
            if include_built_in:
                stmt = stmt.where(
                    or_(Exercise.user_profile_id == user_profile_id, Exercise.is_built_in.is_(True))
                )
            else:
                stmt = stmt.where(Exercise.user_profile_id == user_profile_id)
        elif not include_built_in:
            stmt = stmt.where(Exercise.is_built_in.is_(False))

        # Text search (searches name and instructions)
        if q and q.strip():
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Exercise.name.ilike(term),
                    Exercise.instructions.ilike(term),
                    Exercise.primary_muscle.ilike(term),
                    Exercise.secondary_muscles.ilike(term),
                )
            )

        if primary_muscle and primary_muscle.strip():
            stmt = stmt.where(Exercise.primary_muscle.ilike(primary_muscle.strip()))

        if equipment and equipment.strip():
            stmt = stmt.where(Exercise.equipment_required.ilike(equipment.strip()))

        if movement_category and movement_category.strip():
            stmt = stmt.where(Exercise.movement_category.ilike(movement_category.strip()))

        if difficulty and difficulty.strip():
            stmt = stmt.where(Exercise.difficulty_level.ilike(difficulty.strip()))

        stmt = stmt.order_by(Exercise.is_built_in.desc(), Exercise.name.asc())
        stmt = stmt.offset(skip).limit(limit)

        return list(db.scalars(stmt).all())

    def count_exercises(
        self,
        db: Session,
        user_profile_id: Optional[int] = None,
        q: Optional[str] = None,
        primary_muscle: Optional[str] = None,
        equipment: Optional[str] = None,
        movement_category: Optional[str] = None,
        difficulty: Optional[str] = None,
        include_built_in: bool = True,
    ) -> int:
        stmt = select(Exercise)

        if user_profile_id is not None:
            if include_built_in:
                stmt = stmt.where(
                    or_(Exercise.user_profile_id == user_profile_id, Exercise.is_built_in.is_(True))
                )
            else:
                stmt = stmt.where(Exercise.user_profile_id == user_profile_id)
        elif not include_built_in:
            stmt = stmt.where(Exercise.is_built_in.is_(False))

        if q and q.strip():
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Exercise.name.ilike(term),
                    Exercise.instructions.ilike(term),
                    Exercise.primary_muscle.ilike(term),
                    Exercise.secondary_muscles.ilike(term),
                )
            )

        if primary_muscle and primary_muscle.strip():
            stmt = stmt.where(Exercise.primary_muscle.ilike(primary_muscle.strip()))

        if equipment and equipment.strip():
            stmt = stmt.where(Exercise.equipment_required.ilike(equipment.strip()))

        if movement_category and movement_category.strip():
            stmt = stmt.where(Exercise.movement_category.ilike(movement_category.strip()))

        if difficulty and difficulty.strip():
            stmt = stmt.where(Exercise.difficulty_level.ilike(difficulty.strip()))

        return len(list(db.scalars(stmt).all()))

    def create(self, db: Session, exercise: Exercise) -> Exercise:
        db.add(exercise)
        db.commit()
        db.refresh(exercise)
        return exercise

    def update(self, db: Session, exercise: Exercise, update_data: dict) -> Exercise:
        for field, value in update_data.items():
            if hasattr(exercise, field):
                setattr(exercise, field, value)
        db.commit()
        db.refresh(exercise)
        return exercise

    def delete(self, db: Session, exercise: Exercise) -> None:
        db.delete(exercise)
        db.commit()


exercise_repository = ExerciseRepository()

