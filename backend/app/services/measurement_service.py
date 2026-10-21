from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.domain.body_metrics import calculate_bmi, calculate_fat_mass
from app.models.measurement import BodyMeasurement
from app.repositories.measurement_repository import measurement_repository
from app.repositories.profile_repository import profile_repository
from app.schemas.measurement import (
    BodyMeasurementCreate,
    BodyMeasurementListResponse,
    BodyMeasurementResponse,
    BodyMeasurementUpdate,
)


class MeasurementService:
    def create_measurement(
        self, db: Session, measurement_in: BodyMeasurementCreate
    ) -> BodyMeasurement:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile before logging measurements.",
            )

        # Height to use for BMI calculation: prefer measurement height, fallback to profile height
        effective_height = (
            measurement_in.height_cm
            if measurement_in.height_cm is not None
            else profile.height_cm
        )

        calculated_bmi = None
        if measurement_in.bmi is None and measurement_in.weight_kg is not None:
            calculated_bmi = calculate_bmi(
                measurement_in.weight_kg, effective_height
            )

        return measurement_repository.create(
            db=db,
            measurement_in=measurement_in,
            user_profile_id=profile.id,
            calculated_bmi=calculated_bmi,
        )

    def get_measurement(
        self, db: Session, measurement_id: int
    ) -> BodyMeasurement:
        measurement = measurement_repository.get_by_id(db, measurement_id)
        if not measurement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Measurement with id {measurement_id} not found.",
            )
        return measurement

    def get_latest_measurement(
        self, db: Session
    ) -> Optional[BodyMeasurement]:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            return None
        return measurement_repository.get_latest(db, profile.id)

    def list_measurements(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> BodyMeasurementListResponse:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            return BodyMeasurementListResponse(
                items=[],
                total=0,
                page=page,
                page_size=page_size,
                total_pages=0,
            )

        skip = (page - 1) * page_size
        items = measurement_repository.list_measurements(
            db=db,
            user_profile_id=profile.id,
            skip=skip,
            limit=page_size,
            start_date=start_date,
            end_date=end_date,
        )
        total = measurement_repository.count_measurements(
            db=db,
            user_profile_id=profile.id,
            start_date=start_date,
            end_date=end_date,
        )
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0

        return BodyMeasurementListResponse(
            items=[
                BodyMeasurementResponse.model_validate(item) for item in items
            ],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def update_measurement(
        self,
        db: Session,
        measurement_id: int,
        measurement_in: BodyMeasurementUpdate,
    ) -> BodyMeasurement:
        measurement = self.get_measurement(db, measurement_id)
        return measurement_repository.update(db, measurement, measurement_in)

    def delete_measurement(self, db: Session, measurement_id: int) -> None:
        measurement = self.get_measurement(db, measurement_id)
        measurement_repository.delete(db, measurement)


measurement_service = MeasurementService()

