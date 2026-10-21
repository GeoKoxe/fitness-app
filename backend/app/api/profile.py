from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.profile import (
    UserProfileCreate,
    UserProfileResponse,
    UserProfileUpdate,
)
from app.services.profile_service import profile_service

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get(
    "",
    response_model=Optional[UserProfileResponse],
    summary="Get user profile",
)
def get_profile(db: Session = Depends(get_db)):
    """Retrieve the current user profile, or null if none exists yet."""
    return profile_service.get_profile(db)


@router.post(
    "",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create user profile",
)
def create_profile(
    profile_in: UserProfileCreate, db: Session = Depends(get_db)
):
    """Create the initial user profile."""
    return profile_service.create_profile(db, profile_in)


@router.patch(
    "",
    response_model=UserProfileResponse,
    summary="Update user profile",
)
def update_profile(
    profile_in: UserProfileUpdate, db: Session = Depends(get_db)
):
    """Update fields on the existing user profile."""
    return profile_service.update_profile(db, profile_in)

