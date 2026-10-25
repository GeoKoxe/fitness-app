from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.workout_log import (
    LoggedExercise,
    LoggedExerciseSet,
    WorkoutSessionLog,
)


class WorkoutLogRepository:
    def get_active_session_log(
        self, db: Session, user_profile_id: int
    ) -> Optional[WorkoutSessionLog]:
        stmt = (
            select(WorkoutSessionLog)
            .where(
                WorkoutSessionLog.user_profile_id == user_profile_id,
                WorkoutSessionLog.status == "in_progress",
            )
            .options(
                joinedload(WorkoutSessionLog.exercises).joinedload(
                    LoggedExercise.sets
                )
            )
            .order_by(WorkoutSessionLog.id.desc())
            .limit(1)
        )
        return db.scalars(stmt).unique().first()

    def get_by_id(
        self,
        db: Session,
        session_log_id: int,
        user_profile_id: Optional[int] = None,
    ) -> Optional[WorkoutSessionLog]:
        stmt = (
            select(WorkoutSessionLog)
            .where(WorkoutSessionLog.id == session_log_id)
            .options(
                joinedload(WorkoutSessionLog.exercises).joinedload(
                    LoggedExercise.sets
                )
            )
        )
        if user_profile_id is not None:
            stmt = stmt.where(WorkoutSessionLog.user_profile_id == user_profile_id)
        return db.scalars(stmt).unique().first()

    def list_session_logs(
        self,
        db: Session,
        user_profile_id: int,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[WorkoutSessionLog]:
        stmt = (
            select(WorkoutSessionLog)
            .where(WorkoutSessionLog.user_profile_id == user_profile_id)
            .options(
                joinedload(WorkoutSessionLog.exercises).joinedload(
                    LoggedExercise.sets
                )
            )
            .order_by(WorkoutSessionLog.started_at.desc())
            .offset(skip)
            .limit(limit)
        )
        if status_filter:
            stmt = stmt.where(WorkoutSessionLog.status == status_filter)
        return list(db.scalars(stmt).unique().all())

    def create_session_log(
        self, db: Session, session_log: WorkoutSessionLog
    ) -> WorkoutSessionLog:
        db.add(session_log)
        db.commit()
        db.refresh(session_log)
        return session_log

    def save(
        self, db: Session, session_log: WorkoutSessionLog
    ) -> WorkoutSessionLog:
        db.commit()
        db.refresh(session_log)
        return session_log


workout_log_repository = WorkoutLogRepository()

