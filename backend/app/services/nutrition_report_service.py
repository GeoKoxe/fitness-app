from datetime import date, datetime, time, timedelta
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.meal_log import MealLog
from app.models.measurement import BodyMeasurement
from app.repositories.profile_repository import profile_repository
from app.schemas.nutrition_report import (
    DailyReportItem,
    NutritionReportResponse,
    WeightTrendReport,
)


class NutritionReportService:
    def get_report(
        self, db: Session, start_date: date, end_date: date
    ) -> NutritionReportResponse:
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Start date ({start_date}) cannot be after end date ({end_date}).",
            )

        profile = profile_repository.get_current_profile(db)
        total_days = (end_date - start_date).days + 1

        if not profile:
            return NutritionReportResponse(
                start_date=start_date,
                end_date=end_date,
                total_days=total_days,
                days_with_logs=0,
                days_without_logs=total_days,
                calculation_note="No profile found.",
                daily_items=[],
                weight_trend=WeightTrendReport(
                    has_sufficient_data=False,
                    measurement_count=0,
                    disclaimer="No profile found.",
                ),
            )

        # 1. Fetch meal logs in date range
        stmt = (
            select(MealLog)
            .where(
                MealLog.user_profile_id == profile.id,
                MealLog.logged_date >= start_date,
                MealLog.logged_date <= end_date,
            )
            .order_by(MealLog.logged_date.asc())
        )
        logs = list(db.scalars(stmt).all())

        # Group logs by date
        logs_by_date = {}
        for l in logs:
            logs_by_date.setdefault(l.logged_date, []).append(l)

        # 2. Build Daily Report Items for every calendar date in range
        daily_items: List[DailyReportItem] = []
        cur_date = start_date
        while cur_date <= end_date:
            day_logs = logs_by_date.get(cur_date, [])
            if day_logs:
                total_cal = round(sum(l.calories_kcal for l in day_logs), 1)
                total_pro = round(sum(l.protein_g for l in day_logs), 1)
                total_carb = round(sum(l.carbs_g for l in day_logs), 1)
                total_fat = round(sum(l.fat_g for l in day_logs), 1)

                fibers = [l.fiber_g for l in day_logs if l.fiber_g is not None]
                total_fib = round(sum(fibers), 1) if fibers else None

                sugars = [l.sugar_g for l in day_logs if l.sugar_g is not None]
                total_sug = round(sum(sugars), 1) if sugars else None

                sodiums = [l.sodium_mg for l in day_logs if l.sodium_mg is not None]
                total_sod = round(sum(sodiums), 1) if sodiums else None

                daily_items.append(
                    DailyReportItem(
                        date=cur_date,
                        has_logs=True,
                        entries_count=len(day_logs),
                        calories_kcal=total_cal,
                        protein_g=total_pro,
                        carbs_g=total_carb,
                        fat_g=total_fat,
                        fiber_g=total_fib,
                        sugar_g=total_sug,
                        sodium_mg=total_sod,
                    )
                )
            else:
                daily_items.append(
                    DailyReportItem(
                        date=cur_date,
                        has_logs=False,
                        entries_count=0,
                        calories_kcal=0.0,
                        protein_g=0.0,
                        carbs_g=0.0,
                        fat_g=0.0,
                        fiber_g=None,
                        sugar_g=None,
                        sodium_mg=None,
                    )
                )
            cur_date += timedelta(days=1)

        # 3. Calculate summary averages
        logged_days = [d for d in daily_items if d.has_logs]
        days_with_logs = len(logged_days)
        days_without_logs = total_days - days_with_logs

        if days_with_logs > 0:
            avg_cal = round(sum(d.calories_kcal for d in logged_days) / days_with_logs, 1)
            avg_pro = round(sum(d.protein_g for d in logged_days) / days_with_logs, 1)
            avg_carb = round(sum(d.carbs_g for d in logged_days) / days_with_logs, 1)
            avg_fat = round(sum(d.fat_g for d in logged_days) / days_with_logs, 1)

            fiber_logged = [d.fiber_g for d in logged_days if d.fiber_g is not None]
            avg_fib = round(sum(fiber_logged) / len(fiber_logged), 1) if fiber_logged else None

            calc_note = (
                f"Averages are calculated across the {days_with_logs} day(s) with logged meals "
                f"out of {total_days} total calendar days. Days without logged meals are excluded from "
                "nutrient averages to avoid artificially diluting daily intake."
            )
        else:
            avg_cal = None
            avg_pro = None
            avg_carb = None
            avg_fat = None
            avg_fib = None
            calc_note = f"No meals were logged across this {total_days}-day period."

        # 4. Fetch Weight Measurements in Range
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)

        m_stmt = (
            select(BodyMeasurement)
            .where(
                BodyMeasurement.user_profile_id == profile.id,
                BodyMeasurement.measured_at >= start_dt,
                BodyMeasurement.measured_at <= end_dt,
                BodyMeasurement.weight_kg.is_not(None),
            )
            .order_by(BodyMeasurement.measured_at.asc())
        )
        measurements = list(db.scalars(m_stmt).all())

        disclaimer_text = (
            "Weight changes reflect multiple physiological factors including hydration, glycogen, "
            "sodium, and scale calibration. Nutritional intake and weight changes are reported as "
            "independent historical observations without implied causation."
        )

        if len(measurements) >= 2:
            start_m = measurements[0]
            end_m = measurements[-1]
            weight_diff = round(end_m.weight_kg - start_m.weight_kg, 2)
            weight_trend = WeightTrendReport(
                has_sufficient_data=True,
                measurement_count=len(measurements),
                start_date=start_m.measured_at.date(),
                start_weight_kg=start_m.weight_kg,
                end_date=end_m.measured_at.date(),
                end_weight_kg=end_m.weight_kg,
                weight_change_kg=weight_diff,
                disclaimer=disclaimer_text,
            )
        elif len(measurements) == 1:
            m = measurements[0]
            weight_trend = WeightTrendReport(
                has_sufficient_data=False,
                measurement_count=1,
                start_date=m.measured_at.date(),
                start_weight_kg=m.weight_kg,
                end_date=m.measured_at.date(),
                end_weight_kg=m.weight_kg,
                weight_change_kg=None,
                disclaimer="At least 2 measurements within the selected period are required to calculate weight change. " + disclaimer_text,
            )
        else:
            weight_trend = WeightTrendReport(
                has_sufficient_data=False,
                measurement_count=0,
                start_date=None,
                start_weight_kg=None,
                end_date=None,
                end_weight_kg=None,
                weight_change_kg=None,
                disclaimer="No weight measurements recorded within this period. " + disclaimer_text,
            )

        return NutritionReportResponse(
            start_date=start_date,
            end_date=end_date,
            total_days=total_days,
            days_with_logs=days_with_logs,
            days_without_logs=days_without_logs,
            avg_calories_kcal=avg_cal,
            avg_protein_g=avg_pro,
            avg_carbs_g=avg_carb,
            avg_fat_g=avg_fat,
            avg_fiber_g=avg_fib,
            calculation_note=calc_note,
            daily_items=daily_items,
            weight_trend=weight_trend,
        )


nutrition_report_service = NutritionReportService()

