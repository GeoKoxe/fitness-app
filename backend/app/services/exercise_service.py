import logging
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.exercise import Exercise
from app.repositories.exercise_repository import exercise_repository
from app.schemas.exercise import ExerciseCreate, ExerciseResponse, ExerciseUpdate, slugify

logger = logging.getLogger(__name__)


class ExerciseService:
    def get_exercise_or_404(self, db: Session, exercise_id: int) -> Exercise:
        exercise = exercise_repository.get_by_id(db, exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise with id {exercise_id} not found.",
            )
        return exercise

    def get_by_slug_or_404(self, db: Session, slug: str) -> Exercise:
        exercise = exercise_repository.get_by_slug(db, slug)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise with slug '{slug}' not found.",
            )
        return exercise

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
        return exercise_repository.list_exercises(
            db=db,
            user_profile_id=user_profile_id,
            q=q,
            primary_muscle=primary_muscle,
            equipment=equipment,
            movement_category=movement_category,
            difficulty=difficulty,
            include_built_in=include_built_in,
            skip=skip,
            limit=limit,
        )

    def create_custom_exercise(
        self, db: Session, user_profile_id: int, exercise_in: ExerciseCreate
    ) -> Exercise:
        base_slug = slugify(exercise_in.slug or exercise_in.name)
        if not base_slug:
            base_slug = f"custom_exercise_{int(user_profile_id)}"

        # Check collision
        existing_slug = exercise_repository.get_by_slug(db, base_slug)
        if existing_slug:
            # Suffix with profile id to guarantee uniqueness
            base_slug = f"{base_slug}_{user_profile_id}"
            if exercise_repository.get_by_slug(db, base_slug):
                import uuid
                base_slug = f"{base_slug}_{uuid.uuid4().hex[:6]}"

        exercise = Exercise(
            slug=base_slug,
            name=exercise_in.name.strip(),
            movement_category=exercise_in.movement_category.strip().lower(),
            primary_muscle=exercise_in.primary_muscle.strip().lower(),
            secondary_muscles=exercise_in.secondary_muscles.strip().lower() if exercise_in.secondary_muscles else None,
            equipment_required=exercise_in.equipment_required.strip().lower(),
            difficulty_level=exercise_in.difficulty_level.strip().lower() if exercise_in.difficulty_level else "beginner",
            instructions=exercise_in.instructions.strip() if exercise_in.instructions else None,
            alternative_exercise_slugs=exercise_in.alternative_exercise_slugs.strip() if exercise_in.alternative_exercise_slugs else None,
            is_built_in=False,
            user_profile_id=user_profile_id,
        )

        return exercise_repository.create(db, exercise)

    def update_custom_exercise(
        self, db: Session, exercise_id: int, user_profile_id: int, update_in: ExerciseUpdate
    ) -> Exercise:
        exercise = self.get_exercise_or_404(db, exercise_id)

        # Protection: Built-in exercises cannot be modified
        if exercise.is_built_in:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Built-in exercises are read-only and cannot be modified.",
            )

        if exercise.user_profile_id != user_profile_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify this exercise.",
            )

        update_data = update_in.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"]:
            update_data["name"] = update_data["name"].strip()
        if "movement_category" in update_data and update_data["movement_category"]:
            update_data["movement_category"] = update_data["movement_category"].strip().lower()
        if "primary_muscle" in update_data and update_data["primary_muscle"]:
            update_data["primary_muscle"] = update_data["primary_muscle"].strip().lower()
        if "equipment_required" in update_data and update_data["equipment_required"]:
            update_data["equipment_required"] = update_data["equipment_required"].strip().lower()
        if "difficulty_level" in update_data and update_data["difficulty_level"]:
            update_data["difficulty_level"] = update_data["difficulty_level"].strip().lower()

        return exercise_repository.update(db, exercise, update_data)

    def is_referenced_in_plans_or_logs(self, db: Session, exercise_id: int) -> bool:
        """Extension hook to prevent deletion of custom exercises referenced in future plans or logs."""
        # When workout_plans or workout_logs tables are created in Phase 7.3/7.4,
        # queries checking foreign keys will be placed here.
        return False

    def delete_custom_exercise(
        self, db: Session, exercise_id: int, user_profile_id: int
    ) -> None:
        exercise = self.get_exercise_or_404(db, exercise_id)

        # Protection: Built-in exercises cannot be deleted
        if exercise.is_built_in:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Built-in exercises are protected and cannot be deleted.",
            )

        if exercise.user_profile_id != user_profile_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this exercise.",
            )

        if self.is_referenced_in_plans_or_logs(db, exercise_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete exercise: it is currently referenced in workout plans or logs.",
            )

        exercise_repository.delete(db, exercise)


exercise_service = ExerciseService()

