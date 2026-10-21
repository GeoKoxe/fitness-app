from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.measurement import (
    BodyMeasurementCreate,
    BodyMeasurementListResponse,
    BodyMeasurementResponse,
    BodyMeasurementUpdate,
)
from app.services.measurement_service import measurement_service

router = APIRouter(prefix="/measurements", tags=["Measurements"])


@router.post(
    "",
    response_model=BodyMeasurementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a new body measurement",
)
def create_measurement(
    measurement_in: BodyMeasurementCreate, db: Session = Depends(get_db)
):
    """Log a point-in-time body measurement.

    Historical measurements are preserved and never overwritten.
    """
    return measurement_service.create_measurement(db, measurement_in)


@router.get(
    "",
    response_model=BodyMeasurementListResponse,
    summary="List measurement history",
)
def list_measurements(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    start_date: Optional[datetime] = Query(
        None, description="Filter measurements on or after this datetime"
    ),
    end_date: Optional[datetime] = Query(
        None, description="Filter measurements on or before this datetime"
    ),
    db: Session = Depends(get_db),
):
    """Retrieve historical measurements in reverse-chronological order with pagination."""
    return measurement_service.list_measurements(
        db=db,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/latest",
    response_model=Optional[BodyMeasurementResponse],
    summary="Get latest body measurement",
)
def get_latest_measurement(db: Session = Depends(get_db)):
    """Retrieve the most recent body measurement."""
    return measurement_service.get_latest_measurement(db)


@router.get(
    "/{measurement_id}",
    response_model=BodyMeasurementResponse,
    summary="Get single measurement by ID",
)
def get_measurement(measurement_id: int, db: Session = Depends(get_db)):
    """Retrieve a single measurement record by ID."""
    return measurement_service.get_measurement(db, measurement_id)


@router.patch(
    "/{measurement_id}",
    response_model=BodyMeasurementResponse,
    summary="Update a measurement",
)
def update_measurement(
    measurement_id: int,
    measurement_in: BodyMeasurementUpdate,
    db: Session = Depends(get_db),
):
    """Update specific fields of an existing measurement record."""
    return measurement_service.update_measurement(
        db, measurement_id, measurement_in
    )


@router.delete(
    "/{measurement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a measurement record",
)
def delete_measurement(measurement_id: int, db: Session = Depends(get_db)):
    """Delete a specific measurement record."""
    measurement_service.delete_measurement(db, measurement_id)
    return None

