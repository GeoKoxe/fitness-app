import datetime
import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import engine as app_engine
from app.models.base import Base
from app.models.food import Food
from app.models.meal_log import MealLog
from app.models.measurement import BodyMeasurement
from app.models.profile import UserProfile
from app.models.recipe import Recipe, RecipeIngredient


def test_app_engine_enforces_foreign_keys_pragma():
    """Verify that every connection established by app_engine has foreign_keys enabled."""
    with app_engine.connect() as conn:
        result = conn.execute(text("PRAGMA foreign_keys;")).scalar()
        assert result == 1, f"Expected PRAGMA foreign_keys=1, got {result}"


def test_isolated_sqlite_foreign_key_rejection():
    """Verify that inserting a child record with a non-existent parent foreign key is rejected."""
    iso_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(iso_engine, "connect")
    def _set_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=iso_engine)
    IsoSession = sessionmaker(bind=iso_engine)
    session = IsoSession()

    try:
        # Invalid user_profile_id 99999 does not exist
        orphan_measurement = BodyMeasurement(
            user_profile_id=99999,
            weight_kg=75.0,
            measured_at=datetime.datetime.now(),
        )
        session.add(orphan_measurement)
        with pytest.raises(IntegrityError):
            session.commit()
    finally:
        session.rollback()
        session.close()


def test_sqlite_cascade_delete_behavior():
    """Verify that deleting a UserProfile cascades to delete associated measurements and logs."""
    iso_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(iso_engine, "connect")
    def _set_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=iso_engine)
    IsoSession = sessionmaker(bind=iso_engine)
    session = IsoSession()

    try:
        profile = UserProfile(name="Test Cascade User")
        session.add(profile)
        session.commit()
        session.refresh(profile)

        measurement = BodyMeasurement(
            user_profile_id=profile.id,
            weight_kg=78.5,
            measured_at=datetime.datetime.now(),
        )
        session.add(measurement)
        session.commit()

        # Delete profile
        session.delete(profile)
        session.commit()

        # Confirm measurement was cascaded and removed
        remaining = session.query(BodyMeasurement).filter_by(id=measurement.id).first()
        assert remaining is None
    finally:
        session.close()


def test_sqlite_restrict_delete_behavior():
    """Verify that deleting a Food referenced by RecipeIngredient (RESTRICT) raises IntegrityError."""
    iso_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(iso_engine, "connect")
    def _set_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=iso_engine)
    IsoSession = sessionmaker(bind=iso_engine)
    session = IsoSession()

    try:
        food = Food(
            name="Restricted Oats",
            calories_kcal=389.0,
            protein_g=16.9,
            carbs_g=66.3,
            fat_g=6.9,
        )
        session.add(food)
        session.commit()
        session.refresh(food)

        recipe = Recipe(name="Oatmeal Bowl")
        session.add(recipe)
        session.commit()
        session.refresh(recipe)

        ingredient = RecipeIngredient(
            recipe_id=recipe.id,
            food_id=food.id,
            quantity=80.0,
            unit="g",
        )
        session.add(ingredient)
        session.commit()

        # Attempting to delete food referenced in recipe_ingredient (RESTRICT) must fail
        session.delete(food)
        with pytest.raises(IntegrityError):
            session.commit()
    finally:
        session.rollback()
        session.close()

