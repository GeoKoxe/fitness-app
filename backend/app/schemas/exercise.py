import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_MOVEMENT_CATEGORIES = {
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "squat",
    "hinge",
    "lunge",
    "isolation",
    "core",
    "carry",
    "other",
}

VALID_PRIMARY_MUSCLES = {
    "chest",
    "lats",
    "upper_back",
    "shoulders",
    "biceps",
    "triceps",
    "quadriceps",
    "hamstrings",
    "glutes",
    "calves",
    "abdominals",
    "lower_back",
    "full_body",
    "other",
}

VALID_EQUIPMENT = {
    "barbell",
    "dumbbell",
    "bodyweight",
    "cable",
    "machine",
    "bench",
    "pullup_bar",
    "resistance_band",
    "kettlebell",
    "other",
}

VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}


def slugify(text: str) -> str:
    """Generate a clean URL-friendly slug from text."""
    clean = re.sub(r"[^\w\s-]", "", text.lower().strip())
    return re.sub(r"[\s_-]+", "_", clean)


class ExerciseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Exercise name")
    movement_category: str = Field(..., description="Movement category (e.g., squat, horizontal_push)")
    primary_muscle: str = Field(..., description="Target muscle group")
    secondary_muscles: Optional[str] = Field(None, max_length=200, description="Comma-separated secondary muscle tokens")
    equipment_required: str = Field(..., description="Required equipment (e.g., barbell, dumbbell, bodyweight)")
    difficulty_level: str = Field("beginner", description="beginner, intermediate, or advanced")
    instructions: Optional[str] = Field(None, description="Detailed execution instructions")
    alternative_exercise_slugs: Optional[str] = Field(None, max_length=250, description="Comma-separated alternative exercise slugs")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Exercise name cannot be empty or blank")
        return s

    @field_validator("difficulty_level")
    @classmethod
    def validate_difficulty(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in VALID_DIFFICULTIES:
            return "beginner"
        return clean


class ExerciseCreate(ExerciseBase):
    slug: Optional[str] = Field(None, max_length=100, description="Unique slug; generated from name if omitted")


class ExerciseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    movement_category: Optional[str] = None
    primary_muscle: Optional[str] = None
    secondary_muscles: Optional[str] = None
    equipment_required: Optional[str] = None
    difficulty_level: Optional[str] = None
    instructions: Optional[str] = None
    alternative_exercise_slugs: Optional[str] = None


class ExerciseResponse(ExerciseBase):
    id: int
    slug: str
    is_built_in: bool
    user_profile_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

