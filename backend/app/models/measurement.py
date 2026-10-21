from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class BodyMeasurement(Base, TimestampMixin):
    __tablename__ = "body_measurements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    measured_at = Column(
        DateTime,
        nullable=False,
        index=True,
        default=func.now(),
    )
    source = Column(String(50), nullable=False, default="manual")
    notes = Column(String(500), nullable=True)

    # Core measurements
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    bmi = Column(Float, nullable=True)
    bmi_calculated = Column(Boolean, nullable=False, default=False)

    # Body composition
    body_fat_percentage = Column(Float, nullable=True)
    fat_mass_kg = Column(Float, nullable=True)
    muscle_mass_kg = Column(Float, nullable=True)
    skeletal_muscle_mass_kg = Column(Float, nullable=True)
    body_water_percentage = Column(Float, nullable=True)
    body_water_mass_kg = Column(Float, nullable=True)
    bone_mineral_content_kg = Column(Float, nullable=True)
    visceral_fat_level = Column(Float, nullable=True)
    basal_metabolic_rate_kcal = Column(Float, nullable=True)
    heart_rate_bpm = Column(Integer, nullable=True)

    # Circumferences (cm)
    waist_circumference_cm = Column(Float, nullable=True)
    hip_circumference_cm = Column(Float, nullable=True)
    chest_circumference_cm = Column(Float, nullable=True)
    arms_circumference_cm = Column(Float, nullable=True)
    thighs_circumference_cm = Column(Float, nullable=True)
    neck_circumference_cm = Column(Float, nullable=True)

    user_profile = relationship("UserProfile", back_populates="measurements")

