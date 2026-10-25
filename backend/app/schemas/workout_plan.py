import json
from datetime import date, datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.exercise import ExerciseResponse


class PlannedExerciseResponse(BaseModel):
    id: int
    planned_session_id: int
    exercise_id: Optional[int] = None
    order_in_session: int
    exercise_slug: str
    exercise_name: str
    primary_muscle: str
    secondary_muscles: Optional[str] = None
    movement_category: str
    equipment_required: str
    target_sets: int
    target_reps: str
    rest_seconds: int
    progression_notes: Optional[str] = None
    warmup_guidance: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PlannedWorkoutSessionResponse(BaseModel):
    id: int
    workout_plan_id: int
    day_of_week_index: int
    day_of_week_name: str
    plan_date: date
    is_rest_day: bool
    session_name: str
    session_focus: str
    estimated_duration_minutes: int
    requested_duration_minutes: Optional[int] = None
    warmup_notes: Optional[str] = None
    cooldown_notes: Optional[str] = None
    exercises: List[PlannedExerciseResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class WorkoutPlanResponse(BaseModel):
    id: int
    user_profile_id: int
    name: str
    split_type: str
    start_date: date
    end_date: date
    is_active: bool
    generation_settings: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sessions: List[PlannedWorkoutSessionResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def attach_requested_duration_to_sessions(self) -> "WorkoutPlanResponse":
        req_dur = None
        if self.generation_settings:
            try:
                settings = json.loads(self.generation_settings)
                req_dur = settings.get("preferred_duration_minutes")
            except Exception:
                pass
        if req_dur:
            for s in self.sessions:
                if not s.is_rest_day and s.requested_duration_minutes is None:
                    s.requested_duration_minutes = req_dur
        return self


class WorkoutPlanSummaryResponse(BaseModel):
    id: int
    user_profile_id: int
    name: str
    split_type: str
    start_date: date
    end_date: date
    is_active: bool
    session_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def populate_session_count(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "session_count" not in data or data.get("session_count") is None:
                sessions = data.get("sessions")
                data["session_count"] = len(sessions) if sessions else 0
            return data
        if hasattr(data, "sessions") and (not hasattr(data, "session_count") or getattr(data, "session_count", None) is None):
            sessions = getattr(data, "sessions", [])
            return {
                "id": getattr(data, "id", None),
                "user_profile_id": getattr(data, "user_profile_id", None),
                "name": getattr(data, "name", None),
                "split_type": getattr(data, "split_type", None),
                "start_date": getattr(data, "start_date", None),
                "end_date": getattr(data, "end_date", None),
                "is_active": getattr(data, "is_active", None),
                "session_count": len(sessions) if sessions else 0,
                "created_at": getattr(data, "created_at", None),
            }
        return data


class WorkoutPlanGenerateRequest(BaseModel):
    start_date: Optional[date] = Field(
        None, description="Start date for the 7-day routine (defaults to current week's Monday)"
    )
    name: Optional[str] = Field(None, max_length=200, description="Optional custom routine name")


class ExerciseReplaceRequest(BaseModel):
    new_exercise_id: int = Field(..., description="ID of replacement exercise from catalogue")


class ExerciseAlternativesResponse(BaseModel):
    current_planned_exercise_id: int
    current_exercise_name: str
    compatible_alternatives: List[ExerciseResponse]

