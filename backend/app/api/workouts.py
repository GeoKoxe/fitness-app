from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.training_profile import (
    SavedTrainingProfileCreate,
    SavedTrainingProfileResponse,
    SavedTrainingProfileUpdate,
    TrainingProfileResponse,
    TrainingProfileUpdate,
)
from app.schemas.workout_log import (
    WorkoutSessionLogResponse,
    WorkoutSessionLogSummaryResponse,
    WorkoutSessionLogUpdate,
    WorkoutSessionStartRequest,
    WorkoutSessionTransitionRequest,
)
from app.schemas.workout_analytics import (
    ExercisePerformanceHistoryResponse,
    LoggedExerciseSummaryItem,
    ProgressionRecommendationResponse,
    WorkoutAnalyticsSummaryResponse,
    WorkoutWeeklySeriesResponse,
)
from app.schemas.workout_plan import (
    ExerciseAlternativesResponse,
    ExerciseReplaceRequest,
    WorkoutPlanGenerateRequest,
    WorkoutPlanResponse,
    WorkoutPlanSummaryResponse,
)
from app.services.training_profile_service import training_profile_service
from app.services.workout_analytics_service import workout_analytics_service
from app.services.workout_execution_service import workout_execution_service
from app.services.workout_planner_service import workout_planner_service

router = APIRouter(prefix="/workouts", tags=["workouts"])


# =============================================================================
# Training Profile
# =============================================================================
@router.get("/profile", response_model=TrainingProfileResponse)
def get_training_profile(db: Session = Depends(get_db)):
    """Return the current user's training profile or default profile."""
    return training_profile_service.get_profile(db)


@router.put("/profile", response_model=TrainingProfileResponse)
def update_training_profile(
    profile_in: TrainingProfileUpdate, db: Session = Depends(get_db)
):
    """Create or update the current user's training profile."""
    return training_profile_service.update_profile(db, profile_in)


# Saved Named Training Profile Configurations
@router.get("/profile/saved", response_model=List[SavedTrainingProfileResponse])
def list_saved_training_profiles(db: Session = Depends(get_db)):
    """List all saved named training profile configurations for current user."""
    return training_profile_service.list_saved_configs(db)


@router.post(
    "/profile/saved",
    response_model=SavedTrainingProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_saved_training_profile(
    req: SavedTrainingProfileCreate, db: Session = Depends(get_db)
):
    """Save current configuration under a unique name."""
    return training_profile_service.create_saved_config(db, req)


@router.get(
    "/profile/saved/{saved_id}", response_model=SavedTrainingProfileResponse
)
def get_saved_training_profile(saved_id: int, db: Session = Depends(get_db)):
    """Retrieve a specific saved named training profile configuration."""
    return training_profile_service.get_saved_config(db, saved_id)


@router.put(
    "/profile/saved/{saved_id}", response_model=SavedTrainingProfileResponse
)
def update_saved_training_profile(
    saved_id: int,
    req: SavedTrainingProfileUpdate,
    db: Session = Depends(get_db),
):
    """Update or rename a saved named training profile configuration."""
    return training_profile_service.update_saved_config(db, saved_id, req)


@router.delete(
    "/profile/saved/{saved_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_saved_training_profile(
    saved_id: int, db: Session = Depends(get_db)
):
    """Delete a saved named training profile configuration."""
    training_profile_service.delete_saved_config(db, saved_id)


@router.post(
    "/profile/saved/{saved_id}/apply", response_model=TrainingProfileResponse
)
def apply_saved_training_profile(
    saved_id: int, db: Session = Depends(get_db)
):
    """Apply a saved named configuration to become the user's active training profile."""
    return training_profile_service.apply_saved_config(db, saved_id)


# =============================================================================
# Workout Plans
# =============================================================================
@router.post(
    "/plans/generate",
    response_model=WorkoutPlanResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_workout_plan(
    req: WorkoutPlanGenerateRequest, db: Session = Depends(get_db)
):
    """Generate a deterministic 7-day workout routine from training profile and catalogue."""
    return workout_planner_service.generate_plan(db, req)


@router.get("/plans/active", response_model=Optional[WorkoutPlanResponse])
def get_active_workout_plan(db: Session = Depends(get_db)):
    """Return the current user's active workout plan (or null)."""
    return workout_planner_service.get_active_plan(db)


@router.get("/plans", response_model=List[WorkoutPlanSummaryResponse])
def list_workout_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List historical and active workout plans."""
    return workout_planner_service.list_plans(db, skip=skip, limit=limit)


@router.get("/plans/{plan_id}", response_model=WorkoutPlanResponse)
def get_workout_plan(plan_id: int, db: Session = Depends(get_db)):
    """Retrieve a specific workout plan by ID."""
    return workout_planner_service.get_plan_by_id(db, plan_id)


@router.get(
    "/plans/{plan_id}/exercises/{planned_exercise_id}/alternatives",
    response_model=ExerciseAlternativesResponse,
)
def get_exercise_alternatives(
    plan_id: int, planned_exercise_id: int, db: Session = Depends(get_db)
):
    """Get compatible alternative exercises from catalogue for a planned slot."""
    return workout_planner_service.get_compatible_alternatives(
        db, plan_id, planned_exercise_id
    )


@router.put(
    "/plans/{plan_id}/exercises/{planned_exercise_id}/replace",
    response_model=WorkoutPlanResponse,
)
def replace_planned_exercise(
    plan_id: int,
    planned_exercise_id: int,
    req: ExerciseReplaceRequest,
    db: Session = Depends(get_db),
):
    """Replace a planned exercise with a chosen alternative exercise."""
    return workout_planner_service.replace_exercise(
        db, plan_id, planned_exercise_id, req.new_exercise_id
    )


@router.post(
    "/plans/{plan_id}/exercises/{planned_exercise_id}/regenerate",
    response_model=WorkoutPlanResponse,
)
def regenerate_planned_exercise(
    plan_id: int,
    planned_exercise_id: int,
    db: Session = Depends(get_db),
):
    """Automatically regenerate a planned exercise slot with a compatible alternative."""
    return workout_planner_service.regenerate_exercise(
        db, plan_id, planned_exercise_id
    )


# =============================================================================
# Workout Execution & Session Logging (Phase 7.4)
# =============================================================================
@router.post(
    "/sessions/start",
    response_model=WorkoutSessionLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_workout_session(
    req: WorkoutSessionStartRequest, db: Session = Depends(get_db)
):
    """Start or resume a planned or custom workout execution session."""
    return workout_execution_service.start_session(db, req)


@router.get(
    "/sessions/active", response_model=Optional[WorkoutSessionLogResponse]
)
def get_active_workout_session(db: Session = Depends(get_db)):
    """Retrieve the currently in-progress workout session log (or null)."""
    return workout_execution_service.get_active_session(db)


@router.get(
    "/sessions", response_model=List[WorkoutSessionLogSummaryResponse]
)
def list_workout_sessions(
    status: Optional[str] = Query(None, description="Filter by in_progress, completed, cancelled"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List recent workout execution history."""
    return workout_execution_service.list_sessions(
        db, status_filter=status, skip=skip, limit=limit
    )


@router.get(
    "/sessions/{session_id}", response_model=WorkoutSessionLogResponse
)
def get_workout_session(session_id: int, db: Session = Depends(get_db)):
    """Retrieve full details of a specific logged workout session."""
    return workout_execution_service.get_session_by_id(db, session_id)


@router.put(
    "/sessions/{session_id}", response_model=WorkoutSessionLogResponse
)
def update_workout_session(
    session_id: int,
    update_in: WorkoutSessionLogUpdate,
    db: Session = Depends(get_db),
):
    """Update in-progress workout sets, weights, repetitions, duration, and notes."""
    return workout_execution_service.update_session(db, session_id, update_in)


@router.post(
    "/sessions/{session_id}/complete", response_model=WorkoutSessionLogResponse
)
def complete_workout_session(
    session_id: int,
    transition_in: Optional[WorkoutSessionTransitionRequest] = None,
    db: Session = Depends(get_db),
):
    """Mark a workout session completed."""
    return workout_execution_service.complete_session(
        db, session_id, transition_in
    )


@router.post(
    "/sessions/{session_id}/cancel", response_model=WorkoutSessionLogResponse
)
def cancel_workout_session(
    session_id: int,
    transition_in: Optional[WorkoutSessionTransitionRequest] = None,
    db: Session = Depends(get_db),
):
    """Cancel an active workout session (not counted as completed)."""
    return workout_execution_service.cancel_session(
        db, session_id, transition_in
    )


# =============================================================================
# Workout Analytics & Progression Recommendations (Phase 7.5)
# =============================================================================
@router.get("/analytics/summary", response_model=WorkoutAnalyticsSummaryResponse)
def get_workout_analytics_summary(
    time_range: str = Query("4w", description="Time range: 4w, 12w, or all"),
    db: Session = Depends(get_db),
):
    """Return aggregated workout analytics summary for completed sessions."""
    return workout_analytics_service.get_summary(db, time_range=time_range)


@router.get("/analytics/weekly", response_model=WorkoutWeeklySeriesResponse)
def get_workout_weekly_series(
    time_range: str = Query("4w", description="Time range: 4w, 12w, or all"),
    db: Session = Depends(get_db),
):
    """Return weekly workout volume, duration, and consistency series."""
    return workout_analytics_service.get_weekly_series(db, time_range=time_range)


@router.get(
    "/analytics/exercises", response_model=List[LoggedExerciseSummaryItem]
)
def list_logged_exercises(db: Session = Depends(get_db)):
    """List distinct exercises that have completed performance records in the log."""
    return workout_analytics_service.list_logged_exercises(db)


@router.get(
    "/analytics/exercises/{exercise_identifier}",
    response_model=ExercisePerformanceHistoryResponse,
)
def get_exercise_performance_history(
    exercise_identifier: str,
    time_range: str = Query("all", description="Time range: 4w, 12w, or all"),
    db: Session = Depends(get_db),
):
    """Retrieve performance history, best stats, estimated 1RM, and progression advice for an exercise."""
    return workout_analytics_service.get_exercise_history(
        db, exercise_identifier, time_range=time_range
    )


@router.get(
    "/analytics/recommendations",
    response_model=List[ProgressionRecommendationResponse],
)
def get_progression_recommendations(db: Session = Depends(get_db)):
    """Retrieve progression recommendations for all exercises with recent completed history."""
    return workout_analytics_service.get_all_recommendations(db)

