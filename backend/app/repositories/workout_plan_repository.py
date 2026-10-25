from typing import List, Optional
from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload

from app.models.exercise import Exercise
from app.models.workout_plan import (
    PlannedExercise,
    PlannedWorkoutSession,
    WorkoutPlan,
)


class WorkoutPlanRepository:
    def get_active_plan(
        self, db: Session, user_profile_id: int
    ) -> Optional[WorkoutPlan]:
        stmt = (
            select(WorkoutPlan)
            .where(
                WorkoutPlan.user_profile_id == user_profile_id,
                WorkoutPlan.is_active == True,  # noqa: E712
            )
            .options(
                joinedload(WorkoutPlan.sessions).joinedload(
                    PlannedWorkoutSession.exercises
                )
            )
            .order_by(WorkoutPlan.id.desc())
            .limit(1)
        )
        return db.scalars(stmt).unique().first()

    def get_plan_by_id(
        self, db: Session, plan_id: int, user_profile_id: Optional[int] = None
    ) -> Optional[WorkoutPlan]:
        query = (
            select(WorkoutPlan)
            .where(WorkoutPlan.id == plan_id)
            .options(
                joinedload(WorkoutPlan.sessions).joinedload(
                    PlannedWorkoutSession.exercises
                )
            )
        )
        if user_profile_id is not None:
            query = query.where(WorkoutPlan.user_profile_id == user_profile_id)
        return db.scalars(query).unique().first()

    def list_plans(
        self, db: Session, user_profile_id: int, skip: int = 0, limit: int = 50
    ) -> List[WorkoutPlan]:
        stmt = (
            select(WorkoutPlan)
            .where(WorkoutPlan.user_profile_id == user_profile_id)
            .options(joinedload(WorkoutPlan.sessions))
            .order_by(WorkoutPlan.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).unique().all())

    def deactivate_active_plans(self, db: Session, user_profile_id: int) -> None:
        stmt = (
            update(WorkoutPlan)
            .where(
                WorkoutPlan.user_profile_id == user_profile_id,
                WorkoutPlan.is_active == True,  # noqa: E712
            )
            .values(is_active=False)
        )
        db.execute(stmt)
        db.commit()

    def create_plan(self, db: Session, plan: WorkoutPlan) -> WorkoutPlan:
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return plan

    def get_planned_exercise(
        self, db: Session, planned_exercise_id: int
    ) -> Optional[PlannedExercise]:
        stmt = (
            select(PlannedExercise)
            .where(PlannedExercise.id == planned_exercise_id)
            .options(
                joinedload(PlannedExercise.session).joinedload(
                    PlannedWorkoutSession.workout_plan
                )
            )
            .limit(1)
        )
        return db.scalars(stmt).first()

    def update_planned_exercise(
        self,
        db: Session,
        planned_exercise: PlannedExercise,
        new_exercise: Exercise,
        target_sets: Optional[int] = None,
        target_reps: Optional[str] = None,
        rest_seconds: Optional[int] = None,
        progression_notes: Optional[str] = None,
        warmup_guidance: Optional[str] = None,
    ) -> PlannedExercise:
        planned_exercise.exercise_id = new_exercise.id
        planned_exercise.exercise_slug = new_exercise.slug
        planned_exercise.exercise_name = new_exercise.name
        planned_exercise.primary_muscle = new_exercise.primary_muscle
        planned_exercise.secondary_muscles = new_exercise.secondary_muscles
        planned_exercise.movement_category = new_exercise.movement_category
        planned_exercise.equipment_required = new_exercise.equipment_required

        if target_sets is not None:
            planned_exercise.target_sets = target_sets
        if target_reps is not None:
            planned_exercise.target_reps = target_reps
        if rest_seconds is not None:
            planned_exercise.rest_seconds = rest_seconds
        if progression_notes is not None:
            planned_exercise.progression_notes = progression_notes
        if warmup_guidance is not None:
            planned_exercise.warmup_guidance = warmup_guidance

        db.commit()
        db.refresh(planned_exercise)
        return planned_exercise


workout_plan_repository = WorkoutPlanRepository()

