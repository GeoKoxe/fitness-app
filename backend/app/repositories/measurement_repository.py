from datetime import datetime
from typing import Optional

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.measurement import BodyMeasurement
from app.schemas.measurement import BodyMeasurementCreate, BodyMeasurementUpdate


class MeasurementRepository:
    def get_by_id(
        self, db: Session, measurement_id: int
    ) -> Optional[BodyMeasurement]:
        return db.get(BodyMeasurement, measurement_id)

    def get_latest(
        self, db: Session, user_profile_id: int
    ) -> Optional[BodyMeasurement]:
        stmt = (
            select(BodyMeasurement)
            .where(BodyMeasurement.user_profile_id == user_profile_id)
            .order_by(desc(BodyMeasurement.measured_at))
            .limit(1)
        )
        return db.scalars(stmt).first()

    def list_measurements(
        self,
        db: Session,
        user_profile_id: int,
        skip: int = 0,
        limit: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> list[BodyMeasurement]:
        stmt = select(BodyMeasurement).where(
            BodyMeasurement.user_profile_id == user_profile_id
        )
        if start_date is not None:
            stmt = stmt.where(BodyMeasurement.measured_at >= start_date)
        if end_date is not None:
            stmt = stmt.where(BodyMeasurement.measured_at <= end_date)

        stmt = (
            stmt.order_by(desc(BodyMeasurement.measured_at))
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    def count_measurements(
        self,
        db: Session,
        user_profile_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(BodyMeasurement)
            .where(BodyMeasurement.user_profile_id == user_profile_id)
        )
        if start_date is not None:
            stmt = stmt.where(BodyMeasurement.measured_at >= start_date)
        if end_date is not None:
            stmt = stmt.where(BodyMeasurement.measured_at <= end_date)

        count = db.scalar(stmt)
        return count or 0

    def create(
        self,
        db: Session,
        measurement_in: BodyMeasurementCreate,
        user_profile_id: int,
        calculated_bmi: Optional[float] = None,
    ) -> BodyMeasurement:
        data = measurement_in.model_dump()
        # If BMI was calculated, use it if not explicitly provided
        if data.get("bmi") is None and calculated_bmi is not None:
            data["bmi"] = calculated_bmi
            data["bmi_calculated"] = True
        elif data.get("bmi") is not None:
            data["bmi_calculated"] = False

        measurement = BodyMeasurement(
            user_profile_id=user_profile_id,
            **data,
        )
        db.add(measurement)
        db.commit()
        db.refresh(measurement)
        return measurement

    def update(
        self,
        db: Session,
        measurement: BodyMeasurement,
        measurement_in: BodyMeasurementUpdate,
    ) -> BodyMeasurement:
        data = measurement_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(measurement, field, value)
        db.commit()
        db.refresh(measurement)
        return measurement

    def delete(self, db: Session, measurement: BodyMeasurement) -> None:
        db.delete(measurement)
        db.commit()


measurement_repository = MeasurementRepository()

