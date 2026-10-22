from fastapi import APIRouter

from app.api.foods import router as foods_router
from app.api.health import router as health_router
from app.api.meal_logs import router as meal_logs_router
from app.api.measurements import router as measurements_router
from app.api.nutrition_backup import router as nutrition_backup_router
from app.api.profile import router as profile_router

router = APIRouter()

router.include_router(health_router, prefix="/api")
router.include_router(profile_router, prefix="/api")
router.include_router(measurements_router, prefix="/api")
router.include_router(foods_router, prefix="/api")
router.include_router(meal_logs_router, prefix="/api")
router.include_router(nutrition_backup_router, prefix="/api")
