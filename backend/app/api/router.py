from fastapi import APIRouter

from app.api.exercises import router as exercises_router
from app.api.foods import router as foods_router
from app.api.health import router as health_router
from app.api.meal_logs import router as meal_logs_router
from app.api.meal_plans import router as meal_plans_router
from app.api.measurements import router as measurements_router
from app.api.nutrition_backup import router as nutrition_backup_router
from app.api.nutrition_goals import router as nutrition_goals_router
from app.api.profile import router as profile_router
from app.api.recipes import router as recipes_router
from app.api.workouts import router as workouts_router

router = APIRouter()

router.include_router(health_router, prefix="/api")
router.include_router(profile_router, prefix="/api")
router.include_router(measurements_router, prefix="/api")
router.include_router(foods_router, prefix="/api")
router.include_router(meal_logs_router, prefix="/api")
router.include_router(nutrition_backup_router, prefix="/api")
router.include_router(nutrition_goals_router, prefix="/api")
router.include_router(recipes_router, prefix="/api")
router.include_router(meal_plans_router, prefix="/api")
router.include_router(exercises_router, prefix="/api")
router.include_router(workouts_router, prefix="/api")
