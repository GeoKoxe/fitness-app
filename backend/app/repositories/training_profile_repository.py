from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.training_profile import SavedTrainingProfile, TrainingProfile
from app.schemas.training_profile import TrainingProfileUpdate, join_tokens


class TrainingProfileRepository:
    def get_by_profile_id(
        self, db: Session, user_profile_id: int
    ) -> Optional[TrainingProfile]:
        stmt = (
            select(TrainingProfile)
            .where(TrainingProfile.user_profile_id == user_profile_id)
            .limit(1)
        )
        return db.scalars(stmt).first()

    def save_or_update(
        self, db: Session, user_profile_id: int, profile_in: TrainingProfileUpdate
    ) -> TrainingProfile:
        profile = self.get_by_profile_id(db, user_profile_id)

        update_data = {}
        if profile_in.experience_level is not None:
            update_data["experience_level"] = profile_in.experience_level
        if profile_in.training_goals is not None:
            update_data["training_goals"] = join_tokens(profile_in.training_goals)
        if profile_in.available_days is not None:
            update_data["available_days"] = join_tokens(profile_in.available_days)
        if profile_in.preferred_duration_minutes is not None:
            update_data["preferred_duration_minutes"] = profile_in.preferred_duration_minutes
        if profile_in.available_equipment is not None:
            update_data["available_equipment"] = join_tokens(profile_in.available_equipment)
        if profile_in.excluded_exercises is not None:
            update_data["excluded_exercises"] = join_tokens(profile_in.excluded_exercises)
        if profile_in.excluded_muscle_groups is not None:
            update_data["excluded_muscle_groups"] = join_tokens(profile_in.excluded_muscle_groups)
        if profile_in.training_considerations is not None:
            update_data["training_considerations"] = (
                profile_in.training_considerations.strip()
                if profile_in.training_considerations
                else None
            )

        if not profile:
            # Create with defaults for any unspecified fields
            create_fields = {
                "user_profile_id": user_profile_id,
                "experience_level": update_data.get("experience_level", "beginner"),
                "training_goals": update_data.get("training_goals", "general_fitness"),
                "available_days": update_data.get("available_days", "monday,wednesday,friday"),
                "preferred_duration_minutes": update_data.get("preferred_duration_minutes", 60),
                "available_equipment": update_data.get("available_equipment", "bodyweight,dumbbell"),
                "excluded_exercises": update_data.get("excluded_exercises", ""),
                "excluded_muscle_groups": update_data.get("excluded_muscle_groups", ""),
                "training_considerations": update_data.get("training_considerations", None),
            }
            profile = TrainingProfile(**create_fields)
            db.add(profile)
        else:
            for field, value in update_data.items():
                setattr(profile, field, value)

        db.commit()
        db.refresh(profile)
        return profile

    def list_saved_profiles(
        self, db: Session, user_profile_id: int
    ) -> List[SavedTrainingProfile]:
        stmt = (
            select(SavedTrainingProfile)
            .where(SavedTrainingProfile.user_profile_id == user_profile_id)
            .order_by(SavedTrainingProfile.created_at.asc(), SavedTrainingProfile.id.asc())
        )
        return list(db.scalars(stmt).all())

    def get_saved_profile_by_id(
        self, db: Session, user_profile_id: int, saved_id: int
    ) -> Optional[SavedTrainingProfile]:
        stmt = (
            select(SavedTrainingProfile)
            .where(
                SavedTrainingProfile.user_profile_id == user_profile_id,
                SavedTrainingProfile.id == saved_id,
            )
            .limit(1)
        )
        return db.scalars(stmt).first()

    def get_saved_profile_by_name(
        self, db: Session, user_profile_id: int, name: str
    ) -> Optional[SavedTrainingProfile]:
        stmt = (
            select(SavedTrainingProfile)
            .where(
                SavedTrainingProfile.user_profile_id == user_profile_id,
                SavedTrainingProfile.name == name,
            )
            .limit(1)
        )
        return db.scalars(stmt).first()

    def create_saved_profile(
        self, db: Session, profile: SavedTrainingProfile
    ) -> SavedTrainingProfile:
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    def update_saved_profile(
        self, db: Session, profile: SavedTrainingProfile
    ) -> SavedTrainingProfile:
        db.commit()
        db.refresh(profile)
        return profile

    def delete_saved_profile(
        self, db: Session, profile: SavedTrainingProfile
    ) -> None:
        db.delete(profile)
        db.commit()


training_profile_repository = TrainingProfileRepository()

