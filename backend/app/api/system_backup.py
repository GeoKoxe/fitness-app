from typing import Any, Dict
from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.backup import (
    BackupImportResult,
    SystemBackupV2,
)
from app.services.backup_service import backup_service

router = APIRouter(prefix="/backup", tags=["System Backup & Restore"])


@router.get(
    "/export",
    response_model=SystemBackupV2,
    summary="Export complete FitPulse application data as versioned JSON backup (v2.0)",
)
def export_system_backup(db: Session = Depends(get_db)) -> SystemBackupV2:
    return backup_service.export_system_backup(db)


@router.post(
    "/import",
    response_model=BackupImportResult,
    summary="Restore complete FitPulse application data from versioned JSON backup (supports v2.0 and legacy v1.x)",
)
def import_system_backup(
    data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> BackupImportResult:
    return backup_service.import_backup(db, data)

