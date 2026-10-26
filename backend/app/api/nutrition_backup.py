from typing import Any, Dict, Optional, Union
from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.backup import (
    NutritionExportData,
    NutritionImportResult,
    SystemBackupV2,
)
from app.services.backup_service import backup_service

router = APIRouter(prefix="/nutrition", tags=["Nutrition Backup"])


@router.get(
    "/export",
    response_model=Union[NutritionExportData, SystemBackupV2],
    summary="Export food catalogue and nutrition log records (or full system backup if requested)",
)
def export_nutrition_data(
    format: Optional[str] = Query(
        "v1", description="Backup format: 'v1' for legacy nutrition, 'v2' for complete system backup"
    ),
    db: Session = Depends(get_db),
) -> Union[NutritionExportData, SystemBackupV2]:
    if format and format.lower() in ("v2", "system", "full"):
        return backup_service.export_system_backup(db)
    return backup_service.export_nutrition_data(db)


@router.post(
    "/import",
    response_model=NutritionImportResult,
    summary="Restore food and nutrition records from versioned JSON backup (supports legacy v1.x and v2.0)",
)
def import_nutrition_data(
    data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> NutritionImportResult:
    return backup_service.import_backup(db, data)
