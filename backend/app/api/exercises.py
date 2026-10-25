from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.profile_repository import profile_repository
from app.schemas.exercise import ExerciseCreate, ExerciseResponse, ExerciseUpdate
from app.services.exercise_service import exercise_service

router = APIRouter(prefix="/exercises", tags=["exercises"])


def _get_optional_profile_id(db: Session) -> Optional[int]:
    profile = profile_repository.get_current_profile(db)
    return profile.id if profile else None


def _get_required_profile_id(db: Session) -> int:
    profile = profile_repository.get_current_profile(db)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User profile not found. Please create a user profile first.",
        )
    return profile.id


@router.get("", response_model=List[ExerciseResponse])
def list_exercises(
    q: Optional[str] = Query(None, description="Search term for name or instructions"),
    primary_muscle: Optional[str] = Query(None, description="Filter by primary muscle group"),
    equipment: Optional[str] = Query(None, description="Filter by required equipment"),
    movement_category: Optional[str] = Query(None, description="Filter by movement category"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty level"),
    include_built_in: bool = Query(True, description="Include built-in exercises in results"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    profile_id = _get_optional_profile_id(db)
    return exercise_service.list_exercises(
        db=db,
        user_profile_id=profile_id,
        q=q,
        primary_muscle=primary_muscle,
        equipment=equipment,
        movement_category=movement_category,
        difficulty=difficulty,
        include_built_in=include_built_in,
        skip=skip,
        limit=limit,
    )


@router.get("/{exercise_id}", response_model=ExerciseResponse)
def get_exercise(exercise_id: int, db: Session = Depends(get_db)):
    return exercise_service.get_exercise_or_404(db, exercise_id)


@router.post("", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
def create_exercise(exercise_in: ExerciseCreate, db: Session = Depends(get_db)):
    profile_id = _get_required_profile_id(db)
    return exercise_service.create_custom_exercise(db, profile_id, exercise_in)


@router.put("/{exercise_id}", response_model=ExerciseResponse)
def update_exercise(
    exercise_id: int, update_in: ExerciseUpdate, db: Session = Depends(get_db)
):
    profile_id = _get_required_profile_id(db)
    return exercise_service.update_custom_exercise(db, exercise_id, profile_id, update_in)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    profile_id = _get_required_profile_id(db)
    exercise_service.delete_custom_exercise(db, exercise_id, profile_id)
    return None

