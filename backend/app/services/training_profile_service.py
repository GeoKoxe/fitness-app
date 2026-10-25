from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.training_profile import SavedTrainingProfile
from app.repositories.profile_repository import profile_repository
from app.repositories.training_profile_repository import training_profile_repository
from app.schemas.training_profile import (
    SavedTrainingProfileCreate,
    SavedTrainingProfileResponse,
    SavedTrainingProfileUpdate,
    TrainingProfileResponse,
    TrainingProfileUpdate,
    join_tokens,
    parse_tokens,
)


class TrainingProfileService:
    def get_profile(self, db: Session) -> TrainingProfileResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            return TrainingProfileResponse()

        training_profile = training_profile_repository.get_by_profile_id(
            db, user_profile.id
        )
        if not training_profile:
            return TrainingProfileResponse(user_profile_id=user_profile.id)

        return TrainingProfileResponse.model_validate(training_profile)

    def update_profile(
        self, db: Session, profile_in: TrainingProfileUpdate
    ) -> TrainingProfileResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile before configuring your training profile.",
            )

        training_profile = training_profile_repository.save_or_update(
            db, user_profile.id, profile_in
        )
        return TrainingProfileResponse.model_validate(training_profile)

    def list_saved_configs(
        self, db: Session
    ) -> List[SavedTrainingProfileResponse]:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            return []
        saved = training_profile_repository.list_saved_profiles(
            db, user_profile.id
        )
        return [SavedTrainingProfileResponse.model_validate(s) for s in saved]

    def create_saved_config(
        self, db: Session, req: SavedTrainingProfileCreate
    ) -> SavedTrainingProfileResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile first.",
            )

        existing = training_profile_repository.get_saved_profile_by_name(
            db, user_profile.id, req.name.strip()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A saved training configuration named '{req.name.strip()}' already exists.",
            )

        new_config = SavedTrainingProfile(
            user_profile_id=user_profile.id,
            name=req.name.strip(),
            experience_level=req.experience_level,
            training_goals=join_tokens(req.training_goals),
            available_days=join_tokens(req.available_days),
            preferred_duration_minutes=req.preferred_duration_minutes,
            available_equipment=join_tokens(req.available_equipment),
            excluded_exercises=join_tokens(req.excluded_exercises),
            excluded_muscle_groups=join_tokens(req.excluded_muscle_groups),
            training_considerations=req.training_considerations.strip()
            if req.training_considerations
            else None,
        )
        created = training_profile_repository.create_saved_profile(
            db, new_config
        )
        return SavedTrainingProfileResponse.model_validate(created)

    def get_saved_config(
        self, db: Session, saved_id: int
    ) -> SavedTrainingProfileResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found.",
            )
        config = training_profile_repository.get_saved_profile_by_id(
            db, user_profile.id, saved_id
        )
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Saved configuration {saved_id} not found.",
            )
        return SavedTrainingProfileResponse.model_validate(config)

    def update_saved_config(
        self, db: Session, saved_id: int, req: SavedTrainingProfileUpdate
    ) -> SavedTrainingProfileResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found.",
            )
        config = training_profile_repository.get_saved_profile_by_id(
            db, user_profile.id, saved_id
        )
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Saved configuration {saved_id} not found.",
            )

        if req.name is not None and req.name.strip() != config.name:
            dup = training_profile_repository.get_saved_profile_by_name(
                db, user_profile.id, req.name.strip()
            )
            if dup and dup.id != config.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A saved training configuration named '{req.name.strip()}' already exists.",
                )
            config.name = req.name.strip()

        if req.experience_level is not None:
            config.experience_level = req.experience_level
        if req.training_goals is not None:
            config.training_goals = join_tokens(req.training_goals)
        if req.available_days is not None:
            config.available_days = join_tokens(req.available_days)
        if req.preferred_duration_minutes is not None:
            config.preferred_duration_minutes = req.preferred_duration_minutes
        if req.available_equipment is not None:
            config.available_equipment = join_tokens(req.available_equipment)
        if req.excluded_exercises is not None:
            config.excluded_exercises = join_tokens(req.excluded_exercises)
        if req.excluded_muscle_groups is not None:
            config.excluded_muscle_groups = join_tokens(req.excluded_muscle_groups)
        if req.training_considerations is not None:
            config.training_considerations = (
                req.training_considerations.strip()
                if req.training_considerations
                else None
            )

        updated = training_profile_repository.update_saved_profile(db, config)
        return SavedTrainingProfileResponse.model_validate(updated)

    def delete_saved_config(self, db: Session, saved_id: int) -> None:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found.",
            )
        config = training_profile_repository.get_saved_profile_by_id(
            db, user_profile.id, saved_id
        )
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Saved configuration {saved_id} not found.",
            )
        training_profile_repository.delete_saved_profile(db, config)

    def apply_saved_config(
        self, db: Session, saved_id: int
    ) -> TrainingProfileResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found.",
            )
        config = training_profile_repository.get_saved_profile_by_id(
            db, user_profile.id, saved_id
        )
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Saved configuration {saved_id} not found.",
            )

        # Apply saved configuration settings to active training profile
        update_data = TrainingProfileUpdate(
            experience_level=config.experience_level,
            training_goals=parse_tokens(config.training_goals),
            available_days=parse_tokens(config.available_days),
            preferred_duration_minutes=config.preferred_duration_minutes,
            available_equipment=parse_tokens(config.available_equipment),
            excluded_exercises=parse_tokens(config.excluded_exercises),
            excluded_muscle_groups=parse_tokens(config.excluded_muscle_groups),
            training_considerations=config.training_considerations,
        )
        active_profile = training_profile_repository.save_or_update(
            db, user_profile.id, update_data
        )
        return TrainingProfileResponse.model_validate(active_profile)


training_profile_service = TrainingProfileService()
