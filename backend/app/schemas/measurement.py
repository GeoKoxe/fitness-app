from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.domain.body_metrics import (
    MAX_BMI,
    MAX_BODY_FAT_PCT,
    MAX_CIRCUMFERENCE_CM,
    MAX_HEART_RATE_BPM,
    MAX_HEIGHT_CM,
    MAX_WEIGHT_KG,
    MIN_BMI,
    MIN_BODY_FAT_PCT,
    MIN_CIRCUMFERENCE_CM,
    MIN_HEART_RATE_BPM,
    MIN_HEIGHT_CM,
    MIN_WEIGHT_KG,
)

MEASUREMENT_METRIC_FIELDS = (
    "weight_kg",
    "height_cm",
    "bmi",
    "body_fat_percentage",
    "fat_mass_kg",
    "muscle_mass_kg",
    "skeletal_muscle_mass_kg",
    "body_water_percentage",
    "body_water_mass_kg",
    "bone_mineral_content_kg",
    "visceral_fat_level",
    "basal_metabolic_rate_kcal",
    "heart_rate_bpm",
    "waist_circumference_cm",
    "hip_circumference_cm",
    "chest_circumference_cm",
    "arms_circumference_cm",
    "thighs_circumference_cm",
    "neck_circumference_cm",
)


class BodyMeasurementBase(BaseModel):
    measured_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    source: str = Field(default="manual", max_length=50)
    notes: Optional[str] = Field(None, max_length=500)

    # Core measurements
    weight_kg: Optional[float] = Field(
        None, ge=MIN_WEIGHT_KG, le=MAX_WEIGHT_KG
    )
    height_cm: Optional[float] = Field(
        None, ge=MIN_HEIGHT_CM, le=MAX_HEIGHT_CM
    )
    bmi: Optional[float] = Field(None, ge=MIN_BMI, le=MAX_BMI)
    bmi_calculated: bool = Field(default=False)

    # Body composition
    body_fat_percentage: Optional[float] = Field(
        None, ge=MIN_BODY_FAT_PCT, le=MAX_BODY_FAT_PCT
    )
    fat_mass_kg: Optional[float] = Field(None, ge=0.5, le=250.0)
    muscle_mass_kg: Optional[float] = Field(None, ge=10.0, le=250.0)
    skeletal_muscle_mass_kg: Optional[float] = Field(None, ge=5.0, le=150.0)
    body_water_percentage: Optional[float] = Field(None, ge=20.0, le=85.0)
    body_water_mass_kg: Optional[float] = Field(None, ge=10.0, le=150.0)
    bone_mineral_content_kg: Optional[float] = Field(None, ge=0.5, le=15.0)
    visceral_fat_level: Optional[float] = Field(None, ge=1.0, le=50.0)
    basal_metabolic_rate_kcal: Optional[float] = Field(
        None, ge=500.0, le=5000.0
    )
    heart_rate_bpm: Optional[int] = Field(
        None, ge=MIN_HEART_RATE_BPM, le=MAX_HEART_RATE_BPM
    )

    # Circumferences (cm)
    waist_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    hip_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    chest_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    arms_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    thighs_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    neck_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )

    @field_validator("measured_at")
    @classmethod
    def validate_measured_at(cls, v: datetime) -> datetime:
        # Avoid future dates beyond a reasonable clock skew margin of 1 day
        max_future = datetime.now(timezone.utc) + timedelta(days=1)
        # Normalize timezone if naive
        if v.tzinfo is None:
            v_cmp = v.replace(tzinfo=timezone.utc)
        else:
            v_cmp = v
        if v_cmp > max_future:
            raise ValueError("Measurement date cannot be in the future")
        return v


class BodyMeasurementCreate(BodyMeasurementBase):
    @model_validator(mode="after")
    def validate_has_at_least_one_metric(self) -> "BodyMeasurementCreate":
        has_metric = any(
            getattr(self, field) is not None
            for field in MEASUREMENT_METRIC_FIELDS
        )
        if not has_metric:
            raise ValueError(
                "At least one measurement value must be provided."
            )
        return self


class BodyMeasurementUpdate(BaseModel):
    measured_at: Optional[datetime] = None
    source: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)

    # Core measurements
    weight_kg: Optional[float] = Field(
        None, ge=MIN_WEIGHT_KG, le=MAX_WEIGHT_KG
    )
    height_cm: Optional[float] = Field(
        None, ge=MIN_HEIGHT_CM, le=MAX_HEIGHT_CM
    )
    bmi: Optional[float] = Field(None, ge=MIN_BMI, le=MAX_BMI)
    bmi_calculated: bool = Field(default=False)

    # Body composition
    body_fat_percentage: Optional[float] = Field(
        None, ge=MIN_BODY_FAT_PCT, le=MAX_BODY_FAT_PCT
    )
    fat_mass_kg: Optional[float] = Field(None, ge=0.5, le=250.0)
    muscle_mass_kg: Optional[float] = Field(None, ge=10.0, le=250.0)
    skeletal_muscle_mass_kg: Optional[float] = Field(None, ge=5.0, le=150.0)
    body_water_percentage: Optional[float] = Field(None, ge=20.0, le=85.0)
    body_water_mass_kg: Optional[float] = Field(None, ge=10.0, le=150.0)
    bone_mineral_content_kg: Optional[float] = Field(None, ge=0.5, le=15.0)
    visceral_fat_level: Optional[float] = Field(None, ge=1.0, le=50.0)
    basal_metabolic_rate_kcal: Optional[float] = Field(
        None, ge=500.0, le=5000.0
    )
    heart_rate_bpm: Optional[int] = Field(
        None, ge=MIN_HEART_RATE_BPM, le=MAX_HEART_RATE_BPM
    )

    # Circumferences (cm)
    waist_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    hip_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    chest_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    arms_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    thighs_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )
    neck_circumference_cm: Optional[float] = Field(
        None, ge=MIN_CIRCUMFERENCE_CM, le=MAX_CIRCUMFERENCE_CM
    )


class BodyMeasurementResponse(BodyMeasurementBase):
    id: int
    user_profile_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BodyMeasurementListResponse(BaseModel):
    items: list[BodyMeasurementResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

