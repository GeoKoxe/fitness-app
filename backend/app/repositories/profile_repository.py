from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import UserProfile
from app.schemas.profile import UserProfileCreate, UserProfileUpdate


class ProfileRepository:
    def get_profile(self, db: Session, profile_id: int) -> Optional[UserProfile]:
        return db.get(UserProfile, profile_id)

    def get_current_profile(self, db: Session) -> Optional[UserProfile]:
        stmt = select(UserProfile).order_by(UserProfile.id.asc()).limit(1)
        return db.scalars(stmt).first()

    def create_profile(
        self, db: Session, profile_in: UserProfileCreate
    ) -> UserProfile:
        profile = UserProfile(
            name=profile_in.name,
            date_of_birth=profile_in.date_of_birth,
            sex=profile_in.sex,
            height_cm=profile_in.height_cm,
            activity_level=profile_in.activity_level,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    def update_profile(
        self, db: Session, profile: UserProfile, profile_in: UserProfileUpdate
    ) -> UserProfile:
        update_data = profile_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
        db.commit()
        db.refresh(profile)
        return profile


profile_repository = ProfileRepository()

