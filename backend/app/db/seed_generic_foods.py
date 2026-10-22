"""Idempotent seeder for curated generic foods catalogue."""

import logging
from sqlalchemy.orm import Session

from app.data.generic_foods import GENERIC_FOODS
from app.models.food import Food
from app.repositories.food_repository import food_repository

logger = logging.getLogger(__name__)


def seed_generic_foods(db: Session) -> int:
    """Seed generic foods catalogue if not already present.

    Idempotent:
    - Matches on external_id (e.g. usda_fdc_generic_whole_milk).
    - If already present, skips to preserve any user edits.
    - Never overwrites custom foods or existing records.

    Returns:
        int: Number of new food records inserted.
    """
    inserted = 0
    for food_data in GENERIC_FOODS:
        ext_id = food_data.get("external_id")
        if not ext_id:
            continue

        existing = food_repository.get_by_external_id(db, ext_id)
        if existing is not None:
            continue

        food = Food(**food_data)
        db.add(food)
        inserted += 1

    if inserted > 0:
        db.commit()
        logger.info("Seeded %d generic foods into catalogue.", inserted)
    else:
        logger.debug("Generic foods already seeded. 0 items added.")

    return inserted


if __name__ == "__main__":
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        count = seed_generic_foods(db)
        print(f"Seeded {count} generic foods successfully.")
    finally:
        db.close()

