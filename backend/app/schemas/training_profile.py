from datetime import datetime
from typing import List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.exercise import VALID_EQUIPMENT, VALID_PRIMARY_MUSCLES

VALID_EXPERIENCE_LEVELS = {"beginner", "intermediate", "advanced"}
VALID_TRAINING_GOALS = {"strength", "hypertrophy", "endurance", "general_fitness"}
VALID_WEEKDAYS = {
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
}


def parse_tokens(value: Union[str, List[str], None]) -> List[str]:
    """Parse comma-separated string or list into cleaned list of tokens."""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip().lower() for item in value if str(item).strip()]
    return [s.strip().lower() for s in value.split(",") if s.strip()]


def join_tokens(value: Union[str, List[str], None]) -> str:
    """Serialize list of tokens or string into comma-separated string."""
    if not value:
        return ""
    if isinstance(value, list):
        return ",".join(str(item).strip().lower() for item in value if str(item).strip())
    return value.strip().lower()


def normalize_duration(v: Optional[int]) -> int:
    """Normalize duration to nearest 15-minute increment clamped between 15 and 180.

    Ensures existing stored values that are not divisible by 15 are handled safely
    without data loss or schema validation failures.
    """
    if v is None or v <= 0:
        return 60
    rounded = int(round(v / 15.0) * 15)
    return max(15, min(180, rounded))


class TrainingProfileBase(BaseModel):
    experience_level: str = Field(
        "beginner", description="beginner, intermediate, or advanced"
    )
    training_goals: List[str] = Field(
        default_factory=lambda: ["general_fitness"],
        description="List of training goals",
    )
    available_days: List[str] = Field(
        default_factory=lambda: ["monday", "wednesday", "friday"],
        description="Selected weekdays for workouts",
    )
    preferred_duration_minutes: int = Field(
        60,
        ge=15,
        le=180,
        description="Preferred workout duration in minutes (15 to 180)",
    )
    available_equipment: List[str] = Field(
        default_factory=lambda: ["bodyweight", "dumbbell"],
        description="Available equipment tokens",
    )
    excluded_exercises: List[str] = Field(
        default_factory=list, description="Excluded exercise slugs"
    )
    excluded_muscle_groups: List[str] = Field(
        default_factory=list, description="Excluded muscle group tokens"
    )
    training_considerations: Optional[str] = Field(
        None, description="Injuries, limitations, or general notes"
    )

    @field_validator("experience_level")
    @classmethod
    def validate_experience_level(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in VALID_EXPERIENCE_LEVELS:
            raise ValueError(
                f"Invalid experience level '{clean}'. Must be one of {sorted(VALID_EXPERIENCE_LEVELS)}"
            )
        return clean

    @field_validator("preferred_duration_minutes")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v % 15 != 0:
            raise ValueError(
                f"Preferred duration must be divisible by 15 (received {v} minutes)."
            )
        return v

    @field_validator("training_goals")
    @classmethod
    def validate_training_goals(cls, v: List[str]) -> List[str]:
        cleaned = [item.strip().lower() for item in v if item.strip()]
        if not cleaned:
            raise ValueError("At least one training goal must be selected")
        for g in cleaned:
            if g not in VALID_TRAINING_GOALS:
                raise ValueError(
                    f"Invalid training goal '{g}'. Must be one of {sorted(VALID_TRAINING_GOALS)}"
                )
        return list(dict.fromkeys(cleaned))

    @field_validator("available_days")
    @classmethod
    def validate_available_days(cls, v: List[str]) -> List[str]:
        cleaned = [item.strip().lower() for item in v if item.strip()]
        if not cleaned:
            raise ValueError("At least one available training day must be selected")
        for d in cleaned:
            if d not in VALID_WEEKDAYS:
                raise ValueError(
                    f"Invalid weekday '{d}'. Must be one of {sorted(VALID_WEEKDAYS)}"
                )
        return list(dict.fromkeys(cleaned))

    @field_validator("available_equipment")
    @classmethod
    def validate_equipment(cls, v: List[str]) -> List[str]:
        cleaned = [item.strip().lower() for item in v if item.strip()]
        return list(dict.fromkeys(cleaned))

    @field_validator("excluded_exercises")
    @classmethod
    def validate_excluded_exercises(cls, v: List[str]) -> List[str]:
        cleaned = [item.strip().lower() for item in v if item.strip()]
        return list(dict.fromkeys(cleaned))

    @field_validator("excluded_muscle_groups")
    @classmethod
    def validate_excluded_muscles(cls, v: List[str]) -> List[str]:
        cleaned = [item.strip().lower() for item in v if item.strip()]
        return list(dict.fromkeys(cleaned))


class TrainingProfileUpdate(BaseModel):
    experience_level: Optional[str] = None
    training_goals: Optional[List[str]] = None
    available_days: Optional[List[str]] = None
    preferred_duration_minutes: Optional[int] = Field(None, ge=15, le=180)
    available_equipment: Optional[List[str]] = None
    excluded_exercises: Optional[List[str]] = None
    excluded_muscle_groups: Optional[List[str]] = None
    training_considerations: Optional[str] = None

    @field_validator("experience_level")
    @classmethod
    def validate_experience_level(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.strip().lower()
        if clean not in VALID_EXPERIENCE_LEVELS:
            raise ValueError(
                f"Invalid experience level '{clean}'. Must be one of {sorted(VALID_EXPERIENCE_LEVELS)}"
            )
        return clean

    @field_validator("preferred_duration_minutes")
    @classmethod
    def validate_duration(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v % 15 != 0:
            raise ValueError(
                f"Preferred duration must be divisible by 15 (received {v} minutes)."
            )
        return v

    @field_validator("training_goals")
    @classmethod
    def validate_training_goals(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        cleaned = [item.strip().lower() for item in v if item.strip()]
        if not cleaned:
            raise ValueError("At least one training goal must be selected")
        for g in cleaned:
            if g not in VALID_TRAINING_GOALS:
                raise ValueError(
                    f"Invalid training goal '{g}'. Must be one of {sorted(VALID_TRAINING_GOALS)}"
                )
        return list(dict.fromkeys(cleaned))

    @field_validator("available_days")
    @classmethod
    def validate_available_days(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        cleaned = [item.strip().lower() for item in v if item.strip()]
        if not cleaned:
            raise ValueError("At least one available training day must be selected")
        for d in cleaned:
            if d not in VALID_WEEKDAYS:
                raise ValueError(
                    f"Invalid weekday '{d}'. Must be one of {sorted(VALID_WEEKDAYS)}"
                )
        return list(dict.fromkeys(cleaned))

    @field_validator("available_equipment")
    @classmethod
    def validate_equipment(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        cleaned = [item.strip().lower() for item in v if item.strip()]
        return list(dict.fromkeys(cleaned))

    @field_validator("excluded_exercises")
    @classmethod
    def validate_excluded_exercises(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        cleaned = [item.strip().lower() for item in v if item.strip()]
        return list(dict.fromkeys(cleaned))

    @field_validator("excluded_muscle_groups")
    @classmethod
    def validate_excluded_muscles(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        cleaned = [item.strip().lower() for item in v if item.strip()]
        return list(dict.fromkeys(cleaned))


class TrainingProfileResponse(BaseModel):
    id: Optional[int] = None
    user_profile_id: Optional[int] = None
    experience_level: str = "beginner"
    training_goals: List[str] = Field(default_factory=lambda: ["general_fitness"])
    available_days: List[str] = Field(
        default_factory=lambda: ["monday", "wednesday", "friday"]
    )
    preferred_duration_minutes: int = 60
    available_equipment: List[str] = Field(
        default_factory=lambda: ["bodyweight", "dumbbell"]
    )
    excluded_exercises: List[str] = Field(default_factory=list)
    excluded_muscle_groups: List[str] = Field(default_factory=list)
    training_considerations: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def parse_orm_attributes(cls, data):
        if not isinstance(data, dict):
            return {
                "id": getattr(data, "id", None),
                "user_profile_id": getattr(data, "user_profile_id", None),
                "experience_level": getattr(data, "experience_level", "beginner"),
                "training_goals": parse_tokens(
                    getattr(data, "training_goals", "general_fitness")
                ),
                "available_days": parse_tokens(
                    getattr(data, "available_days", "monday,wednesday,friday")
                ),
                "preferred_duration_minutes": normalize_duration(
                    getattr(data, "preferred_duration_minutes", 60)
                ),
                "available_equipment": parse_tokens(
                    getattr(data, "available_equipment", "bodyweight,dumbbell")
                ),
                "excluded_exercises": parse_tokens(
                    getattr(data, "excluded_exercises", "")
                ),
                "excluded_muscle_groups": parse_tokens(
                    getattr(data, "excluded_muscle_groups", "")
                ),
                "training_considerations": getattr(data, "training_considerations", None),
                "created_at": getattr(data, "created_at", None),
                "updated_at": getattr(data, "updated_at", None),
            }
        return data


class SavedTrainingProfileCreate(BaseModel):
    name: str = Field(
        ..., min_length=1, max_length=100, description="Unique configuration name"
    )
    experience_level: str = "beginner"
    training_goals: List[str] = Field(default_factory=lambda: ["general_fitness"])
    available_days: List[str] = Field(
        default_factory=lambda: ["monday", "wednesday", "friday"]
    )
    preferred_duration_minutes: int = Field(60, ge=15, le=180)
    available_equipment: List[str] = Field(
        default_factory=lambda: ["bodyweight", "dumbbell"]
    )
    excluded_exercises: List[str] = Field(default_factory=list)
    excluded_muscle_groups: List[str] = Field(default_factory=list)
    training_considerations: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Configuration name cannot be empty.")
        return clean

    @field_validator("experience_level")
    @classmethod
    def validate_experience_level(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in VALID_EXPERIENCE_LEVELS:
            raise ValueError(
                f"Invalid experience level '{clean}'. Must be one of {sorted(VALID_EXPERIENCE_LEVELS)}"
            )
        return clean

    @field_validator("preferred_duration_minutes")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v % 15 != 0:
            raise ValueError(
                f"Preferred duration must be divisible by 15 (received {v} minutes)."
            )
        return v


class SavedTrainingProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    experience_level: Optional[str] = None
    training_goals: Optional[List[str]] = None
    available_days: Optional[List[str]] = None
    preferred_duration_minutes: Optional[int] = Field(None, ge=15, le=180)
    available_equipment: Optional[List[str]] = None
    excluded_exercises: Optional[List[str]] = None
    excluded_muscle_groups: Optional[List[str]] = None
    training_considerations: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.strip()
        if not clean:
            raise ValueError("Configuration name cannot be empty.")
        return clean

    @field_validator("preferred_duration_minutes")
    @classmethod
    def validate_duration(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        if v % 15 != 0:
            raise ValueError(
                f"Preferred duration must be divisible by 15 (received {v} minutes)."
            )
        return v


class SavedTrainingProfileResponse(BaseModel):
    id: int
    user_profile_id: int
    name: str
    experience_level: str
    training_goals: List[str]
    available_days: List[str]
    preferred_duration_minutes: int
    available_equipment: List[str]
    excluded_exercises: List[str]
    excluded_muscle_groups: List[str]
    training_considerations: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def parse_orm_attributes(cls, data):
        if not isinstance(data, dict):
            raw_dur = getattr(data, "preferred_duration_minutes", 60)
            return {
                "id": getattr(data, "id", None),
                "user_profile_id": getattr(data, "user_profile_id", None),
                "name": getattr(data, "name", "Unnamed Configuration"),
                "experience_level": getattr(data, "experience_level", "beginner"),
                "training_goals": parse_tokens(
                    getattr(data, "training_goals", "general_fitness")
                ),
                "available_days": parse_tokens(
                    getattr(data, "available_days", "monday,wednesday,friday")
                ),
                "preferred_duration_minutes": normalize_duration(raw_dur),
                "available_equipment": parse_tokens(
                    getattr(data, "available_equipment", "bodyweight,dumbbell")
                ),
                "excluded_exercises": parse_tokens(
                    getattr(data, "excluded_exercises", "")
                ),
                "excluded_muscle_groups": parse_tokens(
                    getattr(data, "excluded_muscle_groups", "")
                ),
                "training_considerations": getattr(data, "training_considerations", None),
                "created_at": getattr(data, "created_at", None),
                "updated_at": getattr(data, "updated_at", None),
            }
        return data

