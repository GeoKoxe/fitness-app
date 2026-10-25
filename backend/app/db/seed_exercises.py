"""Idempotent seeder for built-in exercises catalogue."""

import logging
from sqlalchemy.orm import Session

from app.data.built_in_exercises import BUILT_IN_EXERCISES
from app.models.exercise import Exercise

logger = logging.getLogger(__name__)


def seed_built_in_exercises(db: Session) -> int:
    """Seed built-in exercises into the database if not already present.

    Idempotent:
    - Checks for existing Exercise with matching slug.
    - If found, skips to preserve existing data.
    - Never overwrites custom user exercises (which have user_profile_id != None and is_built_in=False).

    Returns:
        int: Number of new exercise records inserted.
    """
    inserted = 0

    for ex_data in BUILT_IN_EXERCISES:
        slug = ex_data["slug"]
        existing = db.query(Exercise).filter(Exercise.slug == slug).first()
        if existing is not None:
            continue

        exercise = Exercise(
            slug=slug,
            name=ex_data["name"],
            movement_category=ex_data["movement_category"],
            primary_muscle=ex_data["primary_muscle"],
            secondary_muscles=ex_data.get("secondary_muscles"),
            equipment_required=ex_data["equipment_required"],
            difficulty_level=ex_data.get("difficulty_level", "beginner"),
            instructions=ex_data.get("instructions"),
            alternative_exercise_slugs=ex_data.get("alternative_exercise_slugs"),
            is_built_in=True,
            user_profile_id=None,
        )
        db.add(exercise)
        inserted += 1

    if inserted > 0:
        db.commit()
        logger.info("Seeded %d built-in exercises.", inserted)
    else:
        logger.debug("Built-in exercises already seeded. 0 items added.")

    return inserted


if __name__ == "__main__":
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        count = seed_built_in_exercises(db)
        print(f"Seeded {count} built-in exercises successfully.")
    finally:
        db.close()

