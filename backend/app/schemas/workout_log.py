from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoggedExerciseSetBase(BaseModel):
    set_number: int = Field(..., ge=1, le=50)
    weight_kg: Optional[float] = Field(None, ge=0, le=1000)
    reps: Optional[int] = Field(None, ge=0, le=200)
    is_completed: bool = False
    is_skipped: bool = False
    notes: Optional[str] = Field(None, max_length=255)

    @field_validator("weight_kg")
    @classmethod
    def validate_weight(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Weight cannot be negative")
        return v

    @field_validator("reps")
    @classmethod
    def validate_reps(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Repetitions cannot be negative")
        return v


class LoggedExerciseSetUpdate(LoggedExerciseSetBase):
    id: Optional[int] = None
    completed_at: Optional[datetime] = None


class LoggedExerciseSetResponse(LoggedExerciseSetBase):
    id: int
    logged_exercise_id: int
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LoggedExerciseBase(BaseModel):
    exercise_id: Optional[int] = None
    planned_exercise_id: Optional[int] = None
    order_in_session: int
    exercise_slug: str
    exercise_name: str
    primary_muscle: str
    equipment_required: str
    movement_category: str
    target_sets: Optional[int] = None
    target_reps: Optional[str] = None
    rest_seconds: Optional[int] = None
    notes: Optional[str] = None


class LoggedExerciseUpdate(BaseModel):
    id: Optional[int] = None
    exercise_id: Optional[int] = None
    planned_exercise_id: Optional[int] = None
    order_in_session: int
    notes: Optional[str] = None
    sets: List[LoggedExerciseSetUpdate] = Field(default_factory=list)


class LoggedExerciseResponse(LoggedExerciseBase):
    id: int
    session_log_id: int
    sets: List[LoggedExerciseSetResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class WorkoutSessionStartRequest(BaseModel):
    planned_session_id: Optional[int] = Field(
        None, description="ID of planned workout session to execute (if starting from a routine)"
    )
    session_name: Optional[str] = Field(
        None, max_length=100, description="Optional custom session title"
    )
    notes: Optional[str] = None


class WorkoutSessionLogUpdate(BaseModel):
    session_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=0)
    exercises: Optional[List[LoggedExerciseUpdate]] = None
    client_version: Optional[int] = Field(
        None, description="Expected current session version for optimistic concurrency control"
    )
    force_overwrite: bool = Field(
        False, description="Explicit user action to bypass version check and overwrite"
    )
    client_updated_at: Optional[datetime] = Field(
        None, description="Optional client updated_at timestamp (legacy fallback)"
    )


class WorkoutSessionTransitionRequest(BaseModel):
    client_version: Optional[int] = Field(
        None, description="Expected current session version for lifecycle state transition"
    )
    force_overwrite: bool = Field(
        False, description="Explicit user action to bypass version check and force transition"
    )


class WorkoutSessionLogResponse(BaseModel):
    id: int
    user_profile_id: int
    workout_plan_id: Optional[int] = None
    planned_session_id: Optional[int] = None
    session_name: str
    session_focus: Optional[str] = None
    status: str  # in_progress, completed, cancelled
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    version: int = 1
    exercises: List[LoggedExerciseResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class WorkoutSessionLogSummaryResponse(BaseModel):
    id: int
    user_profile_id: int
    workout_plan_id: Optional[int] = None
    planned_session_id: Optional[int] = None
    session_name: str
    session_focus: Optional[str] = None
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: int
    total_exercises: int
    completed_sets: int
    created_at: datetime
    version: int = 1

    model_config = ConfigDict(from_attributes=True)

