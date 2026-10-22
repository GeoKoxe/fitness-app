from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.backup import NutritionExportData, NutritionImportResult
from app.services.backup_service import backup_service

router = APIRouter(prefix="/nutrition", tags=["Nutrition Backup"])


@router.get(
    "/export",
    response_model=NutritionExportData,
    summary="Export all food catalogue and nutrition log records as versioned JSON",
)
def export_nutrition_data(db: Session = Depends(get_db)) -> NutritionExportData:
    return backup_service.export_nutrition_data(db)


@router.post(
    "/import",
    response_model=NutritionImportResult,
    summary="Restore food and nutrition records from versioned JSON backup",
)
def import_nutrition_data(
    data: NutritionExportData, db: Session = Depends(get_db)
) -> NutritionImportResult:
    return backup_service.import_nutrition_data(db, data)

