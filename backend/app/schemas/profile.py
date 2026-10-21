from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.body_metrics import MAX_HEIGHT_CM, MIN_HEIGHT_CM

SexType = Literal["male", "female", "other"]
ActivityLevelType = Literal[
    "sedentary",
    "lightly_active",
    "moderately_active",
    "very_active",
    "extra_active",
]


class UserProfileBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    sex: Optional[SexType] = None
    height_cm: Optional[float] = Field(None, ge=MIN_HEIGHT_CM, le=MAX_HEIGHT_CM)
    activity_level: Optional[ActivityLevelType] = None

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: Optional[date]) -> Optional[date]:
        if v is not None:
            today = date.today()
            if v > today:
                raise ValueError("Date of birth cannot be in the future")
            if v.year < 1900:
                raise ValueError("Date of birth year must be 1900 or later")
        return v


class UserProfileCreate(UserProfileBase):
    pass


class UserProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    sex: Optional[SexType] = None
    height_cm: Optional[float] = Field(None, ge=MIN_HEIGHT_CM, le=MAX_HEIGHT_CM)
    activity_level: Optional[ActivityLevelType] = None

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: Optional[date]) -> Optional[date]:
        if v is not None:
            today = date.today()
            if v > today:
                raise ValueError("Date of birth cannot be in the future")
            if v.year < 1900:
                raise ValueError("Date of birth year must be 1900 or later")
        return v


class UserProfileResponse(UserProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

