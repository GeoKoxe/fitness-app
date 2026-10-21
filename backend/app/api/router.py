from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.measurements import router as measurements_router
from app.api.profile import router as profile_router

router = APIRouter()

router.include_router(health_router, prefix="/api")
router.include_router(profile_router, prefix="/api")
router.include_router(measurements_router, prefix="/api")
