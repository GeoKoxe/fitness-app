from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ExerciseFrequencyItem(BaseModel):
    exercise_slug: str
    exercise_name: str
    primary_muscle: str
    completed_count: int

    model_config = ConfigDict(from_attributes=True)


class WorkoutAnalyticsSummaryResponse(BaseModel):
    time_range: str
    total_completed_workouts: int
    active_training_days: int
    total_training_duration_seconds: int
    average_session_duration_seconds: Optional[int] = None
    total_completed_sets: int
    total_completed_reps: int
    target_training_days_per_week: int
    consistency_percentage: Optional[float] = None
    exercise_frequency: List[ExerciseFrequencyItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class WorkoutWeeklyDatapoint(BaseModel):
    week_label: str
    start_date: str
    end_date: str
    completed_workouts: int
    total_duration_minutes: int
    completed_sets: int
    target_workouts: int
    consistency_percent: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class WorkoutWeeklySeriesResponse(BaseModel):
    time_range: str
    weeks: List[WorkoutWeeklyDatapoint] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProgressionRecommendationResponse(BaseModel):
    exercise_slug: str
    exercise_name: str
    category: str  # "increase_load" | "maintain_load" | "review_technique_recovery" | "insufficient_data"
    headline: str
    rationale: str
    suggested_action: str
    supporting_evidence: List[str] = Field(default_factory=list)
    is_advisory: bool = True

    model_config = ConfigDict(from_attributes=True)


class LoggedSetPerformance(BaseModel):
    set_number: int
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    is_completed: bool
    is_skipped: bool
    estimated_1rm_kg: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ExerciseSessionPerformance(BaseModel):
    session_id: int
    session_name: str
    completed_at: str
    target_sets: Optional[int] = None
    target_reps: Optional[str] = None
    best_set_weight_kg: Optional[float] = None
    session_estimated_1rm_kg: Optional[float] = None
    total_volume_kg: Optional[float] = None
    sets: List[LoggedSetPerformance] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ExercisePerformanceHistoryResponse(BaseModel):
    exercise_slug: str
    exercise_name: str
    primary_muscle: str
    equipment_required: str
    movement_category: str
    best_weight_kg: Optional[float] = None
    best_reps_at_best_weight: Optional[int] = None
    best_estimated_1rm_kg: Optional[float] = None
    is_1rm_estimate: bool = True
    total_completed_sessions: int
    total_completed_sets: int
    sessions: List[ExerciseSessionPerformance] = Field(default_factory=list)
    recommendation: Optional[ProgressionRecommendationResponse] = None

    model_config = ConfigDict(from_attributes=True)


class LoggedExerciseSummaryItem(BaseModel):
    exercise_slug: str
    exercise_name: str
    primary_muscle: str
    equipment_required: str
    completed_sessions_count: int

    model_config = ConfigDict(from_attributes=True)

