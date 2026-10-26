from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.workout_log import (
    LoggedExercise,
    LoggedExerciseSet,
    WorkoutSessionLog,
)
from app.models.workout_plan import (
    PlannedWorkoutSession,
)
from app.repositories.exercise_repository import exercise_repository
from app.repositories.profile_repository import profile_repository
from app.repositories.workout_log_repository import workout_log_repository
from app.schemas.workout_log import (
    WorkoutSessionLogResponse,
    WorkoutSessionLogSummaryResponse,
    WorkoutSessionLogUpdate,
    WorkoutSessionStartRequest,
    WorkoutSessionTransitionRequest,
)


class WorkoutExecutionService:
    def start_session(
        self, db: Session, req: WorkoutSessionStartRequest
    ) -> WorkoutSessionLogResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile first.",
            )

        # Check existing in-progress session
        existing_active = workout_log_repository.get_active_session_log(
            db, user_profile.id
        )
        if existing_active:
            # If for the exact same planned session, resume it idempotently
            if (
                req.planned_session_id is not None
                and existing_active.planned_session_id == req.planned_session_id
            ):
                return WorkoutSessionLogResponse.model_validate(existing_active)

            # Otherwise, prevent simultaneous active sessions
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"An active session '{existing_active.session_name}' is already in progress. "
                    "Please complete or cancel it before starting a new workout."
                ),
            )

        # Starting from a planned session
        if req.planned_session_id is not None:
            planned_session = db.scalars(
                select(PlannedWorkoutSession).where(
                    PlannedWorkoutSession.id == req.planned_session_id
                )
            ).first()

            if not planned_session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Planned session with ID {req.planned_session_id} not found.",
                )

            # Validate plan belongs to active user
            if planned_session.workout_plan.user_profile_id != user_profile.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot execute a workout plan belonging to another profile.",
                )

            session_log = WorkoutSessionLog(
                user_profile_id=user_profile.id,
                workout_plan_id=planned_session.workout_plan_id,
                planned_session_id=planned_session.id,
                session_name=req.session_name or planned_session.session_name,
                session_focus=planned_session.session_focus,
                status="in_progress",
                started_at=datetime.now(),
                duration_seconds=0,
                notes=req.notes,
            )

            # Pre-populate logged exercises and sets from planned exercises
            for p_ex in planned_session.exercises:
                logged_ex = LoggedExercise(
                    exercise_id=p_ex.exercise_id,
                    planned_exercise_id=p_ex.id,
                    order_in_session=p_ex.order_in_session,
                    exercise_slug=p_ex.exercise_slug,
                    exercise_name=p_ex.exercise_name,
                    primary_muscle=p_ex.primary_muscle,
                    equipment_required=p_ex.equipment_required,
                    movement_category=p_ex.movement_category,
                    target_sets=p_ex.target_sets,
                    target_reps=p_ex.target_reps,
                    rest_seconds=p_ex.rest_seconds,
                    notes=p_ex.progression_notes,
                )

                num_sets = p_ex.target_sets if p_ex.target_sets and p_ex.target_sets > 0 else 3
                for s_num in range(1, num_sets + 1):
                    logged_set = LoggedExerciseSet(
                        set_number=s_num,
                        weight_kg=None,
                        reps=None,
                        is_completed=False,
                        is_skipped=False,
                    )
                    logged_ex.sets.append(logged_set)

                session_log.exercises.append(logged_ex)

        else:
            # Custom ad-hoc session
            session_log = WorkoutSessionLog(
                user_profile_id=user_profile.id,
                session_name=req.session_name or "Custom Workout Session",
                session_focus="General Training",
                status="in_progress",
                started_at=datetime.now(),
                duration_seconds=0,
                notes=req.notes,
            )

        created = workout_log_repository.create_session_log(db, session_log)
        return WorkoutSessionLogResponse.model_validate(created)

    def get_active_session(
        self, db: Session
    ) -> Optional[WorkoutSessionLogResponse]:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            return None
        active_log = workout_log_repository.get_active_session_log(
            db, user_profile.id
        )
        if not active_log:
            return None
        return WorkoutSessionLogResponse.model_validate(active_log)

    def list_sessions(
        self,
        db: Session,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[WorkoutSessionLogSummaryResponse]:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            return []

        logs = workout_log_repository.list_session_logs(
            db,
            user_profile.id,
            status_filter=status_filter,
            skip=skip,
            limit=limit,
        )

        summaries = []
        for log in logs:
            total_exercises = len(log.exercises)
            completed_sets = sum(
                1
                for ex in log.exercises
                for s in ex.sets
                if s.is_completed and not s.is_skipped
            )
            summaries.append(
                WorkoutSessionLogSummaryResponse(
                    id=log.id,
                    user_profile_id=log.user_profile_id,
                    workout_plan_id=log.workout_plan_id,
                    planned_session_id=log.planned_session_id,
                    session_name=log.session_name,
                    session_focus=log.session_focus,
                    status=log.status,
                    started_at=log.started_at,
                    completed_at=log.completed_at,
                    duration_seconds=log.duration_seconds,
                    total_exercises=total_exercises,
                    completed_sets=completed_sets,
                    created_at=log.created_at,
                    version=log.version or 1,
                )
            )
        return summaries

    def get_session_by_id(
        self, db: Session, session_id: int
    ) -> WorkoutSessionLogResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )

        log = workout_log_repository.get_by_id(db, session_id, user_profile.id)
        if not log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workout session log with ID {session_id} not found",
            )
        return WorkoutSessionLogResponse.model_validate(log)

    def update_session(
        self, db: Session, session_id: int, update_in: WorkoutSessionLogUpdate
    ) -> WorkoutSessionLogResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )

        session_log = workout_log_repository.get_by_id(
            db, session_id, user_profile.id
        )
        if not session_log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workout session log with ID {session_id} not found",
            )

        # Terminal state protection
        if session_log.status != "in_progress":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update a workout session with status '{session_log.status}'.",
            )

        # 1. Mandatory version validation
        if not update_in.force_overwrite and update_in.client_version is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="client_version is required for workout session updates.",
            )

        # In-memory check against current snapshot
        if not update_in.force_overwrite and update_in.client_version is not None:
            if session_log.version != update_in.client_version:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Workout session conflict: expected version {update_in.client_version}, "
                        f"but server is at version {session_log.version}. "
                        "The workout was modified in another window or tab."
                    ),
                )

        now = datetime.now()

        # 2. Atomic conditional database update on WorkoutSessionLog
        stmt = (
            update(WorkoutSessionLog)
            .where(
                WorkoutSessionLog.id == session_id,
                WorkoutSessionLog.user_profile_id == user_profile.id,
                WorkoutSessionLog.status == "in_progress",
            )
        )
        if not update_in.force_overwrite and update_in.client_version is not None:
            stmt = stmt.where(WorkoutSessionLog.version == update_in.client_version)

        values_to_update = {
            WorkoutSessionLog.version: WorkoutSessionLog.version + 1,
            WorkoutSessionLog.updated_at: now,
        }
        if update_in.session_name is not None:
            values_to_update[WorkoutSessionLog.session_name] = update_in.session_name
        if update_in.notes is not None:
            values_to_update[WorkoutSessionLog.notes] = update_in.notes
        if update_in.duration_seconds is not None:
            values_to_update[WorkoutSessionLog.duration_seconds] = max(0, update_in.duration_seconds)

        stmt = stmt.values(values_to_update).execution_options(synchronize_session=False)
        result = db.execute(stmt)

        # Concurrency conflict or status change in race
        if result.rowcount == 0:
            db.rollback()
            fresh = workout_log_repository.get_by_id(db, session_id, user_profile.id)
            if not fresh:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Workout session log with ID {session_id} not found",
                )
            if fresh.status != "in_progress":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot update a workout session with status '{fresh.status}'.",
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Workout session conflict: expected version {update_in.client_version}, "
                    f"but server is at version {fresh.version}. "
                    "The workout was modified in another window or tab."
                ),
            )

        # 3. Conditional update succeeded; update exercises and sets in same transaction
        if update_in.exercises is not None:
            existing_ex_map = {ex.id: ex for ex in session_log.exercises}

            for ex_update in update_in.exercises:
                target_ex = None
                if ex_update.id and ex_update.id in existing_ex_map:
                    target_ex = existing_ex_map[ex_update.id]
                else:
                    for ex in session_log.exercises:
                        if ex.order_in_session == ex_update.order_in_session:
                            target_ex = ex
                            break

                if not target_ex:
                    ex_name = "Logged Exercise"
                    ex_slug = "logged_exercise"
                    prim_mus = "full_body"
                    equip = "bodyweight"
                    mov_cat = "other"
                    if ex_update.exercise_id:
                        ex_obj = exercise_repository.get_by_id(db, ex_update.exercise_id)
                        if ex_obj:
                            ex_name = ex_obj.name
                            ex_slug = ex_obj.slug
                            prim_mus = ex_obj.primary_muscle
                            equip = ex_obj.equipment_required
                            mov_cat = ex_obj.movement_category

                    target_ex = LoggedExercise(
                        session_log_id=session_log.id,
                        exercise_id=ex_update.exercise_id,
                        order_in_session=ex_update.order_in_session,
                        exercise_name=ex_name,
                        exercise_slug=ex_slug,
                        primary_muscle=prim_mus,
                        equipment_required=equip,
                        movement_category=mov_cat,
                    )
                    session_log.exercises.append(target_ex)
                    existing_ex_map[target_ex.id or 0] = target_ex

                if ex_update.notes is not None:
                    target_ex.notes = ex_update.notes

                existing_sets_map = {s.set_number: s for s in target_ex.sets}
                for set_update in ex_update.sets:
                    target_set = existing_sets_map.get(set_update.set_number)
                    if not target_set:
                        target_set = LoggedExerciseSet(
                            set_number=set_update.set_number,
                            logged_exercise_id=target_ex.id,
                        )
                        target_ex.sets.append(target_set)

                    if set_update.weight_kg is not None and set_update.weight_kg < 0:
                        db.rollback()
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Weight cannot be negative",
                        )
                    if set_update.reps is not None and set_update.reps < 0:
                        db.rollback()
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Repetitions cannot be negative",
                        )

                    target_set.weight_kg = set_update.weight_kg
                    target_set.reps = set_update.reps
                    target_set.is_completed = set_update.is_completed
                    target_set.is_skipped = set_update.is_skipped
                    target_set.notes = set_update.notes

                    if set_update.is_completed and not target_set.completed_at:
                        target_set.completed_at = now
                    elif not set_update.is_completed:
                        target_set.completed_at = None

        db.commit()
        db.refresh(session_log)
        return WorkoutSessionLogResponse.model_validate(session_log)

    def complete_session(
        self,
        db: Session,
        session_id: int,
        transition_in: Optional[WorkoutSessionTransitionRequest] = None,
    ) -> WorkoutSessionLogResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )

        session_log = workout_log_repository.get_by_id(
            db, session_id, user_profile.id
        )
        if not session_log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workout session log with ID {session_id} not found",
            )

        if session_log.status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot complete a cancelled workout session.",
            )

        if session_log.status == "completed":
            return WorkoutSessionLogResponse.model_validate(session_log)

        client_version = transition_in.client_version if transition_in else None
        force_overwrite = transition_in.force_overwrite if transition_in else False

        if not force_overwrite and client_version is not None:
            if session_log.version != client_version:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Workout session conflict: expected version {client_version}, "
                        f"but server is at version {session_log.version}. "
                        "The workout was modified in another window or tab."
                    ),
                )

        now = datetime.now()
        stmt = (
            update(WorkoutSessionLog)
            .where(
                WorkoutSessionLog.id == session_id,
                WorkoutSessionLog.user_profile_id == user_profile.id,
                WorkoutSessionLog.status == "in_progress",
            )
        )
        if not force_overwrite and client_version is not None:
            stmt = stmt.where(WorkoutSessionLog.version == client_version)

        stmt = stmt.values(
            status="completed",
            completed_at=now,
            version=WorkoutSessionLog.version + 1,
            updated_at=now,
        ).execution_options(synchronize_session=False)

        res = db.execute(stmt)
        if res.rowcount == 0:
            db.rollback()
            fresh = workout_log_repository.get_by_id(db, session_id, user_profile.id)
            if fresh and fresh.status == "completed":
                return WorkoutSessionLogResponse.model_validate(fresh)
            fresh_v = fresh.version if fresh else "unknown"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Workout session conflict: expected version {client_version}, "
                    f"but server is at version {fresh_v}. "
                    "The workout was modified in another window or tab."
                ),
            )

        db.commit()
        db.refresh(session_log)
        return WorkoutSessionLogResponse.model_validate(session_log)

    def cancel_session(
        self,
        db: Session,
        session_id: int,
        transition_in: Optional[WorkoutSessionTransitionRequest] = None,
    ) -> WorkoutSessionLogResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )

        session_log = workout_log_repository.get_by_id(
            db, session_id, user_profile.id
        )
        if not session_log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workout session log with ID {session_id} not found",
            )

        if session_log.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel an already completed workout session.",
            )

        if session_log.status == "cancelled":
            return WorkoutSessionLogResponse.model_validate(session_log)

        client_version = transition_in.client_version if transition_in else None
        force_overwrite = transition_in.force_overwrite if transition_in else False

        if not force_overwrite and client_version is not None:
            if session_log.version != client_version:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Workout session conflict: expected version {client_version}, "
                        f"but server is at version {session_log.version}. "
                        "The workout was modified in another window or tab."
                    ),
                )

        now = datetime.now()
        stmt = (
            update(WorkoutSessionLog)
            .where(
                WorkoutSessionLog.id == session_id,
                WorkoutSessionLog.user_profile_id == user_profile.id,
                WorkoutSessionLog.status == "in_progress",
            )
        )
        if not force_overwrite and client_version is not None:
            stmt = stmt.where(WorkoutSessionLog.version == client_version)

        stmt = stmt.values(
            status="cancelled",
            completed_at=now,
            version=WorkoutSessionLog.version + 1,
            updated_at=now,
        ).execution_options(synchronize_session=False)

        res = db.execute(stmt)
        if res.rowcount == 0:
            db.rollback()
            fresh = workout_log_repository.get_by_id(db, session_id, user_profile.id)
            if fresh and fresh.status == "cancelled":
                return WorkoutSessionLogResponse.model_validate(fresh)
            fresh_v = fresh.version if fresh else "unknown"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Workout session conflict: expected version {client_version}, "
                    f"but server is at version {fresh_v}. "
                    "The workout was modified in another window or tab."
                ),
            )

        db.commit()
        db.refresh(session_log)
        return WorkoutSessionLogResponse.model_validate(session_log)


workout_execution_service = WorkoutExecutionService()
