from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.profile import UserProfile
from app.repositories.profile_repository import profile_repository
from app.schemas.profile import UserProfileCreate, UserProfileUpdate


class ProfileService:
    def get_profile(self, db: Session) -> Optional[UserProfile]:
        return profile_repository.get_current_profile(db)

    def create_profile(
        self, db: Session, profile_in: UserProfileCreate
    ) -> UserProfile:
        existing = profile_repository.get_current_profile(db)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user profile already exists. Use PATCH /api/profile to update it.",
            )
        return profile_repository.create_profile(db, profile_in)

    def update_profile(
        self, db: Session, profile_in: UserProfileUpdate
    ) -> UserProfile:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found. Please create one first.",
            )
        return profile_repository.update_profile(db, profile, profile_in)


profile_service = ProfileService()

