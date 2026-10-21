from sqlalchemy import Column, Date, Float, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    sex = Column(String(20), nullable=True)
    height_cm = Column(Float, nullable=True)
    activity_level = Column(String(30), nullable=True)

    measurements = relationship(
        "BodyMeasurement",
        back_populates="user_profile",
        cascade="all, delete-orphan",
        order_by="desc(BodyMeasurement.measured_at)",
    )

