import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.core.database import SessionLocal, get_db
from app.db.seed_generic_foods import seed_generic_foods
from app.db.seed_recipes import seed_built_in_recipes
from app.db.seed_exercises import seed_built_in_exercises

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed generic foods & built-in recipes if not present (idempotent)
    db = None
    try:
        if get_db in app.dependency_overrides:
            override = app.dependency_overrides[get_db]
            gen = override()
            db = next(gen)
        else:
            db = SessionLocal()
        food_count = seed_generic_foods(db)
        if food_count > 0:
            logger.info("Startup: Seeded %d generic foods into database.", food_count)
        recipe_count = seed_built_in_recipes(db)
        if recipe_count > 0:
            logger.info("Startup: Seeded %d built-in recipes into database.", recipe_count)
        exercise_count = seed_built_in_exercises(db)
        if exercise_count > 0:
            logger.info("Startup: Seeded %d built-in exercises into database.", exercise_count)
    except Exception as exc:
        logger.warning("Startup: Data seeding encountered error: %s", exc)
    finally:
        if db is not None:
            db.close()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Fitness App API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    return app


app = create_app()
