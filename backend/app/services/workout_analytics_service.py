from datetime import datetime, timedelta
import re
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.exercise import Exercise
from app.models.training_profile import TrainingProfile
from app.models.workout_log import (
    LoggedExercise,
    LoggedExerciseSet,
    WorkoutSessionLog,
)
from app.repositories.profile_repository import profile_repository
from app.schemas.workout_analytics import (
    ExerciseFrequencyItem,
    ExercisePerformanceHistoryResponse,
    ExerciseSessionPerformance,
    LoggedExerciseSummaryItem,
    LoggedSetPerformance,
    ProgressionRecommendationResponse,
    WorkoutAnalyticsSummaryResponse,
    WorkoutWeeklyDatapoint,
    WorkoutWeeklySeriesResponse,
)


def calculate_epley_1rm(weight_kg: Optional[float], reps: Optional[int]) -> Optional[float]:
    """
    Calculate estimated 1RM using the Epley formula:
        1RM = weight * (1 + reps / 30.0)
    For 1 rep, 1RM = weight.
    Only calculated for 1 <= reps <= 12 and weight_kg > 0.
    Returns float rounded to 1 decimal place, or None if invalid.
    Clearly labelled as an estimate.
    """
    if weight_kg is None or weight_kg <= 0:
        return None
    if reps is None or reps < 1 or reps > 12:
        return None
    if reps == 1:
        return round(float(weight_kg), 1)
    estimated = float(weight_kg) * (1.0 + float(reps) / 30.0)
    return round(estimated, 1)


def parse_target_rep_range(target_reps_str: Optional[str]) -> Tuple[int, int]:
    """
    Parse a target reps string like '8-10', '10', '12-15' into (min_rep, max_rep).
    Defaults to (8, 12) if missing or unparseable.
    """
    if not target_reps_str:
        return 8, 12
    # Match pattern '8-10' or '8 - 10'
    range_match = re.search(r"(\d+)\s*[-–—]\s*(\d+)", target_reps_str)
    if range_match:
        try:
            return int(range_match.group(1)), int(range_match.group(2))
        except ValueError:
            pass
    # Match single number '10'
    single_match = re.search(r"(\d+)", target_reps_str)
    if single_match:
        try:
            val = int(single_match.group(1))
            return val, val
        except ValueError:
            pass
    return 8, 12


class WorkoutAnalyticsService:
    def _get_time_cutoff(self, time_range: str) -> Optional[datetime]:
        normalized = time_range.strip().lower()
        now = datetime.now()
        if normalized == "4w":
            return now - timedelta(days=28)
        elif normalized == "12w":
            return now - timedelta(days=84)
        elif normalized == "all":
            return None
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid time_range '{time_range}'. Must be '4w', '12w', or 'all'.",
            )

    def _get_completed_sessions_query(
        self, db: Session, user_profile_id: int, cutoff: Optional[datetime]
    ) -> List[WorkoutSessionLog]:
        query = (
            select(WorkoutSessionLog)
            .where(
                WorkoutSessionLog.user_profile_id == user_profile_id,
                WorkoutSessionLog.status == "completed",
            )
            .order_by(WorkoutSessionLog.completed_at.asc(), WorkoutSessionLog.id.asc())
        )
        if cutoff is not None:
            query = query.where(WorkoutSessionLog.completed_at >= cutoff)

        return list(db.scalars(query).all())

    def get_summary(
        self, db: Session, time_range: str = "4w"
    ) -> WorkoutAnalyticsSummaryResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile first.",
            )

        cutoff = self._get_time_cutoff(time_range)
        completed_sessions = self._get_completed_sessions_query(
            db, user_profile.id, cutoff
        )

        total_completed_workouts = len(completed_sessions)
        unique_dates = set()
        total_duration_seconds = 0
        total_completed_sets = 0
        total_completed_reps = 0
        exercise_counts: Dict[str, Dict[str, any]] = {}

        for s in completed_sessions:
            if s.completed_at:
                unique_dates.add(s.completed_at.date())
            elif s.started_at:
                unique_dates.add(s.started_at.date())

            if s.duration_seconds and s.duration_seconds > 0:
                total_duration_seconds += s.duration_seconds

            for ex in s.exercises:
                slug = ex.exercise_slug
                if slug not in exercise_counts:
                    exercise_counts[slug] = {
                        "exercise_slug": slug,
                        "exercise_name": ex.exercise_name,
                        "primary_muscle": ex.primary_muscle,
                        "completed_count": 0,
                    }
                exercise_counts[slug]["completed_count"] += 1

                for st in ex.sets:
                    if st.is_completed and not st.is_skipped:
                        total_completed_sets += 1
                        if st.reps is not None and st.reps > 0:
                            total_completed_reps += st.reps

        avg_duration = (
            round(total_duration_seconds / total_completed_workouts)
            if total_completed_workouts > 0
            else None
        )

        # Training profile consistency
        training_profile = db.scalar(
            select(TrainingProfile).where(
                TrainingProfile.user_profile_id == user_profile.id
            )
        )
        target_days = 0
        if training_profile and training_profile.available_days:
            target_days = len(
                [d.strip() for d in training_profile.available_days.split(",") if d.strip()]
            )

        consistency_percentage: Optional[float] = None
        if target_days > 0:
            norm_range = time_range.strip().lower()
            if norm_range == "4w":
                expected_workouts = 4 * target_days
            elif norm_range == "12w":
                expected_workouts = 12 * target_days
            else:
                if total_completed_workouts == 0:
                    expected_workouts = target_days
                else:
                    sorted_dates = sorted(unique_dates)
                    if sorted_dates:
                        days_span = (sorted_dates[-1] - sorted_dates[0]).days
                        weeks_span = max(1, (days_span // 7) + 1)
                    else:
                        weeks_span = 1
                    expected_workouts = weeks_span * target_days

            if expected_workouts > 0:
                consistency_percentage = round(
                    min(100.0, (total_completed_workouts / expected_workouts) * 100), 1
                )

        frequency_list = [
            ExerciseFrequencyItem(**item)
            for item in sorted(
                exercise_counts.values(),
                key=lambda x: x["completed_count"],
                reverse=True,
            )
        ]

        return WorkoutAnalyticsSummaryResponse(
            time_range=time_range,
            total_completed_workouts=total_completed_workouts,
            active_training_days=len(unique_dates),
            total_training_duration_seconds=total_duration_seconds,
            average_session_duration_seconds=avg_duration,
            total_completed_sets=total_completed_sets,
            total_completed_reps=total_completed_reps,
            target_training_days_per_week=target_days,
            consistency_percentage=consistency_percentage,
            exercise_frequency=frequency_list,
        )

    def get_weekly_series(
        self, db: Session, time_range: str = "4w"
    ) -> WorkoutWeeklySeriesResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile first.",
            )

        cutoff = self._get_time_cutoff(time_range)
        completed_sessions = self._get_completed_sessions_query(
            db, user_profile.id, cutoff
        )

        training_profile = db.scalar(
            select(TrainingProfile).where(
                TrainingProfile.user_profile_id == user_profile.id
            )
        )
        target_workouts = 0
        if training_profile and training_profile.available_days:
            target_workouts = len(
                [d.strip() for d in training_profile.available_days.split(",") if d.strip()]
            )

        # Build week buckets
        now = datetime.now()
        norm_range = time_range.strip().lower()
        if norm_range == "4w":
            num_weeks = 4
        elif norm_range == "12w":
            num_weeks = 12
        else:
            if completed_sessions:
                earliest = min(s.completed_at or s.started_at for s in completed_sessions)
                days_span = (now - earliest).days
                num_weeks = max(4, min(52, (days_span // 7) + 1))
            else:
                num_weeks = 4

        # Generate buckets from oldest to newest
        weeks_data: List[WorkoutWeeklyDatapoint] = []
        for i in range(num_weeks - 1, -1, -1):
            w_start = (now - timedelta(days=(i + 1) * 7)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            w_end = (now - timedelta(days=i * 7)).replace(
                hour=23, minute=59, second=59, microsecond=999999
            )

            # Match sessions within this week window
            week_sessions = [
                s
                for s in completed_sessions
                if s.completed_at and w_start <= s.completed_at <= w_end
            ]

            comp_workouts = len(week_sessions)
            dur_mins = round(
                sum(s.duration_seconds for s in week_sessions if s.duration_seconds > 0)
                / 60.0
            )
            comp_sets = sum(
                sum(
                    1
                    for st in ex.sets
                    if st.is_completed and not st.is_skipped
                )
                for s in week_sessions
                for ex in s.exercises
            )

            consistency: Optional[float] = None
            if target_workouts > 0:
                consistency = round(
                    min(100.0, (comp_workouts / target_workouts) * 100), 1
                )

            label = f"{w_start.strftime('%b %d')} - {w_end.strftime('%b %d')}"
            weeks_data.append(
                WorkoutWeeklyDatapoint(
                    week_label=label,
                    start_date=w_start.strftime("%Y-%m-%d"),
                    end_date=w_end.strftime("%Y-%m-%d"),
                    completed_workouts=comp_workouts,
                    total_duration_minutes=dur_mins,
                    completed_sets=comp_sets,
                    target_workouts=target_workouts,
                    consistency_percent=consistency,
                )
            )

        return WorkoutWeeklySeriesResponse(time_range=time_range, weeks=weeks_data)

    def list_logged_exercises(
        self, db: Session
    ) -> List[LoggedExerciseSummaryItem]:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile first.",
            )

        # Get all distinct exercises from completed sessions
        query = (
            select(
                LoggedExercise.exercise_slug,
                LoggedExercise.exercise_name,
                LoggedExercise.primary_muscle,
                LoggedExercise.equipment_required,
                WorkoutSessionLog.id,
            )
            .join(
                WorkoutSessionLog,
                LoggedExercise.session_log_id == WorkoutSessionLog.id,
            )
            .where(
                WorkoutSessionLog.user_profile_id == user_profile.id,
                WorkoutSessionLog.status == "completed",
            )
        )
        rows = db.execute(query).all()

        counts: Dict[str, Dict[str, any]] = {}
        for row in rows:
            slug, name, muscle, equip, session_id = row
            if slug not in counts:
                counts[slug] = {
                    "exercise_slug": slug,
                    "exercise_name": name,
                    "primary_muscle": muscle,
                    "equipment_required": equip,
                    "sessions": set(),
                }
            counts[slug]["sessions"].add(session_id)

        result = [
            LoggedExerciseSummaryItem(
                exercise_slug=data["exercise_slug"],
                exercise_name=data["exercise_name"],
                primary_muscle=data["primary_muscle"],
                equipment_required=data["equipment_required"],
                completed_sessions_count=len(data["sessions"]),
            )
            for data in sorted(
                counts.values(), key=lambda x: x["exercise_name"].lower()
            )
        ]
        return result

    def get_exercise_history(
        self, db: Session, exercise_identifier: str, time_range: str = "all"
    ) -> ExercisePerformanceHistoryResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile first.",
            )

        cutoff = self._get_time_cutoff(time_range)

        # Match by slug or id
        is_numeric = exercise_identifier.isdigit()
        query = (
            select(LoggedExercise)
            .join(
                WorkoutSessionLog,
                LoggedExercise.session_log_id == WorkoutSessionLog.id,
            )
            .where(
                WorkoutSessionLog.user_profile_id == user_profile.id,
                WorkoutSessionLog.status == "completed",
            )
        )
        if is_numeric:
            query = query.where(
                (LoggedExercise.exercise_id == int(exercise_identifier))
                | (LoggedExercise.exercise_slug == exercise_identifier)
            )
        else:
            query = query.where(LoggedExercise.exercise_slug == exercise_identifier)

        if cutoff is not None:
            query = query.where(WorkoutSessionLog.completed_at >= cutoff)

        query = query.order_by(WorkoutSessionLog.completed_at.asc(), WorkoutSessionLog.id.asc())
        logged_exercises = list(db.scalars(query).all())

        # If empty, check catalogue
        if not logged_exercises:
            cat_ex = None
            if is_numeric:
                cat_ex = db.scalar(
                    select(Exercise).where(Exercise.id == int(exercise_identifier))
                )
            if not cat_ex:
                cat_ex = db.scalar(
                    select(Exercise).where(Exercise.slug == exercise_identifier)
                )

            if not cat_ex:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Exercise '{exercise_identifier}' not found in logs or catalogue.",
                )

            # Return empty history for catalogue exercise
            rec = ProgressionRecommendationResponse(
                exercise_slug=cat_ex.slug,
                exercise_name=cat_ex.name,
                category="insufficient_data",
                headline="No completed session data",
                rationale=f"No completed workout logs found for '{cat_ex.name}'. Complete a session to receive progression advice.",
                suggested_action="Log completed sets with repetitions and working weights during your next workout.",
                supporting_evidence=["No historical logged sets recorded in database."],
                is_advisory=True,
            )
            return ExercisePerformanceHistoryResponse(
                exercise_slug=cat_ex.slug,
                exercise_name=cat_ex.name,
                primary_muscle=cat_ex.primary_muscle,
                equipment_required=cat_ex.equipment_required,
                movement_category=cat_ex.movement_category,
                best_weight_kg=None,
                best_reps_at_best_weight=None,
                best_estimated_1rm_kg=None,
                is_1rm_estimate=True,
                total_completed_sessions=0,
                total_completed_sets=0,
                sessions=[],
                recommendation=rec,
            )

        # Baseline info from latest logged exercise snapshot
        latest_snapshot = logged_exercises[-1]
        slug = latest_snapshot.exercise_slug
        name = latest_snapshot.exercise_name
        muscle = latest_snapshot.primary_muscle
        equipment = latest_snapshot.equipment_required
        category = latest_snapshot.movement_category

        session_performances: List[ExerciseSessionPerformance] = []
        overall_best_weight: Optional[float] = None
        best_reps_for_best_weight: Optional[int] = None
        overall_best_1rm: Optional[float] = None
        total_completed_sets = 0

        for logged_ex in logged_exercises:
            session_log = logged_ex.session_log
            if not session_log:
                continue

            session_date = (
                session_log.completed_at.strftime("%Y-%m-%d %H:%M")
                if session_log.completed_at
                else session_log.started_at.strftime("%Y-%m-%d %H:%M")
            )

            set_perf_list: List[LoggedSetPerformance] = []
            session_best_weight: Optional[float] = None
            session_best_1rm: Optional[float] = None
            session_volume = 0.0

            for st in logged_ex.sets:
                is_valid_comp = st.is_completed and not st.is_skipped
                est_1rm = (
                    calculate_epley_1rm(st.weight_kg, st.reps)
                    if is_valid_comp
                    else None
                )

                if is_valid_comp:
                    total_completed_sets += 1
                    if st.weight_kg is not None and st.weight_kg > 0:
                        if (
                            session_best_weight is None
                            or st.weight_kg > session_best_weight
                        ):
                            session_best_weight = st.weight_kg

                        if st.reps is not None and st.reps > 0:
                            session_volume += st.weight_kg * st.reps

                        # Update overall best weight and reps
                        if (
                            overall_best_weight is None
                            or st.weight_kg > overall_best_weight
                        ):
                            overall_best_weight = st.weight_kg
                            best_reps_for_best_weight = st.reps
                        elif (
                            st.weight_kg == overall_best_weight
                            and st.reps is not None
                            and (
                                best_reps_for_best_weight is None
                                or st.reps > best_reps_for_best_weight
                            )
                        ):
                            best_reps_for_best_weight = st.reps

                    if est_1rm is not None:
                        if (
                            session_best_1rm is None
                            or est_1rm > session_best_1rm
                        ):
                            session_best_1rm = est_1rm
                        if (
                            overall_best_1rm is None
                            or est_1rm > overall_best_1rm
                        ):
                            overall_best_1rm = est_1rm

                set_perf_list.append(
                    LoggedSetPerformance(
                        set_number=st.set_number,
                        weight_kg=st.weight_kg,
                        reps=st.reps,
                        is_completed=st.is_completed,
                        is_skipped=st.is_skipped,
                        estimated_1rm_kg=est_1rm,
                    )
                )

            session_performances.append(
                ExerciseSessionPerformance(
                    session_id=session_log.id,
                    session_name=session_log.session_name,
                    completed_at=session_date,
                    target_sets=logged_ex.target_sets,
                    target_reps=logged_ex.target_reps,
                    best_set_weight_kg=session_best_weight,
                    session_estimated_1rm_kg=session_best_1rm,
                    total_volume_kg=round(session_volume, 1) if session_volume > 0 else None,
                    sets=set_perf_list,
                )
            )

        # Progression recommendation based on completed sessions
        recommendation = self._calculate_progression(
            slug=slug,
            name=name,
            equipment=equipment,
            primary_muscle=muscle,
            movement_category=category,
            logged_exercises=logged_exercises,
        )

        return ExercisePerformanceHistoryResponse(
            exercise_slug=slug,
            exercise_name=name,
            primary_muscle=muscle,
            equipment_required=equipment,
            movement_category=category,
            best_weight_kg=overall_best_weight,
            best_reps_at_best_weight=best_reps_for_best_weight,
            best_estimated_1rm_kg=overall_best_1rm,
            is_1rm_estimate=True,
            total_completed_sessions=len(session_performances),
            total_completed_sets=total_completed_sets,
            sessions=session_performances,
            recommendation=recommendation,
        )

    def _calculate_progression(
        self,
        slug: str,
        name: str,
        equipment: str,
        primary_muscle: str,
        movement_category: str,
        logged_exercises: List[LoggedExercise],
    ) -> ProgressionRecommendationResponse:
        if not logged_exercises:
            return ProgressionRecommendationResponse(
                exercise_slug=slug,
                exercise_name=name,
                category="insufficient_data",
                headline="No completed session data",
                rationale="Log at least one completed workout session containing this exercise to generate progression guidance.",
                suggested_action="Record working sets and reps during your next workout.",
                supporting_evidence=["No historical logged sets found."],
                is_advisory=True,
            )

        # Evaluate the most recent completed performance
        latest_ex = logged_exercises[-1]
        completed_sets = [
            st for st in latest_ex.sets if st.is_completed and not st.is_skipped
        ]
        skipped_sets = [st for st in latest_ex.sets if st.is_skipped]

        if not completed_sets:
            return ProgressionRecommendationResponse(
                exercise_slug=slug,
                exercise_name=name,
                category="insufficient_data",
                headline="No completed sets in recent session",
                rationale=f"In the most recent session, 0 sets were marked as completed ({len(skipped_sets)} skipped).",
                suggested_action="Complete and log your working sets to establish a baseline.",
                supporting_evidence=[
                    f"Session had {len(latest_ex.sets)} sets planned but none completed."
                ],
                is_advisory=True,
            )

        min_rep, max_rep = parse_target_rep_range(latest_ex.target_reps)
        target_sets = latest_ex.target_sets or len(latest_ex.sets)

        weights = [st.weight_kg for st in completed_sets if st.weight_kg is not None]
        reps_list = [st.reps for st in completed_sets if st.reps is not None]

        # Missing reps check
        if len(reps_list) < len(completed_sets):
            return ProgressionRecommendationResponse(
                exercise_slug=slug,
                exercise_name=name,
                category="insufficient_data",
                headline="Incomplete repetition data",
                rationale="One or more completed sets did not record repetition numbers.",
                suggested_action="Enter both weight and repetition values for every completed set.",
                supporting_evidence=[
                    f"Recorded reps for {len(reps_list)} of {len(completed_sets)} completed sets."
                ],
                is_advisory=True,
            )

        rep_summary_str = ", ".join(f"Set {st.set_number}: {st.reps} reps" + (f" @ {st.weight_kg}kg" if st.weight_kg else "") for st in completed_sets)
        evidence: List[str] = [
            f"Prescription: {target_sets} sets × {latest_ex.target_reps or f'{min_rep}-{max_rep}'} reps",
            f"Recent Performance: {rep_summary_str}",
        ]

        # Check A: Incomplete session or skipped sets
        if len(skipped_sets) > 0 or len(completed_sets) < target_sets:
            evidence.append(
                f"Completed {len(completed_sets)} of {target_sets} planned sets ({len(skipped_sets)} skipped)."
            )
            return ProgressionRecommendationResponse(
                exercise_slug=slug,
                exercise_name=name,
                category="review_technique_recovery",
                headline="Review technique or recovery before progressing",
                rationale=(
                    f"Only {len(completed_sets)} of {target_sets} planned sets were completed "
                    f"with {len(skipped_sets)} skipped. Consolidate full volume before adding load."
                ),
                suggested_action="Aim to finish all prescribed sets with solid technique and appropriate rest intervals before progressing.",
                supporting_evidence=evidence,
                is_advisory=True,
            )

        # Check B: Severe fatigue drop across sets (e.g. drop of 4+ reps between first set and later set)
        if len(reps_list) >= 2 and (reps_list[0] - min(reps_list) >= 4):
            evidence.append(
                f"Repetition drop of {reps_list[0] - min(reps_list)} reps between Set 1 ({reps_list[0]}) and lowest set ({min(reps_list)})."
            )
            return ProgressionRecommendationResponse(
                exercise_slug=slug,
                exercise_name=name,
                category="review_technique_recovery",
                headline="Review fatigue and recovery between sets",
                rationale=(
                    f"A noticeable performance drop occurred across sets ({reps_list[0]} -> {min(reps_list)} reps). "
                    "Ensure adequate rest (90-120 seconds for compound lifts) and stable pacing before increasing weight."
                ),
                suggested_action="Maintain current load and allow full recovery between sets to achieve even performance across all sets.",
                supporting_evidence=evidence,
                is_advisory=True,
            )

        # Check C: Reps fell below the minimum prescribed target
        under_target_count = sum(1 for r in reps_list if r < min_rep)
        if under_target_count >= max(1, len(reps_list) // 2):
            evidence.append(
                f"{under_target_count} of {len(reps_list)} sets fell below target minimum of {min_rep} reps."
            )
            return ProgressionRecommendationResponse(
                exercise_slug=slug,
                exercise_name=name,
                category="review_technique_recovery",
                headline="Consolidate reps at current weight",
                rationale=(
                    f"Repetitions on {under_target_count} set(s) fell below the prescribed target minimum of {min_rep} reps. "
                    "Working weight may currently be slightly too demanding for the intended repetition range."
                ),
                suggested_action=f"Maintain or slightly deload working weight until all sets consistently reach {min_rep} reps.",
                supporting_evidence=evidence,
                is_advisory=True,
            )

        # Check D: Ready for progression (All completed sets reached or exceeded max_rep)
        if all(r >= max_rep for r in reps_list):
            is_bodyweight = equipment.lower() == "bodyweight" or not weights
            if is_bodyweight:
                evidence.append(
                    f"All {len(completed_sets)} sets achieved the upper prescription of {max_rep} reps."
                )
                return ProgressionRecommendationResponse(
                    exercise_slug=slug,
                    exercise_name=name,
                    category="increase_load",
                    headline="Consider progressing bodyweight variation or reps",
                    rationale=(
                        f"All {len(completed_sets)} sets met or exceeded the upper target of {max_rep} reps. "
                        "You have demonstrated proficiency at this level."
                    ),
                    suggested_action=f"Add 1-2 reps per set next session or progress to a more challenging variation.",
                    supporting_evidence=evidence,
                    is_advisory=True,
                )
            else:
                max_w = max(weights)
                is_lower_body = (
                    primary_muscle.lower()
                    in ["quadriceps", "hamstrings", "glutes", "calves"]
                    or movement_category.lower() in ["squat", "hip_hinge", "lunge"]
                )
                increment = 5.0 if is_lower_body else 2.5
                evidence.append(
                    f"All sets completed at or above {max_rep} reps with {max_w} kg."
                )
                est_1rm_values = [
                    calculate_epley_1rm(st.weight_kg, st.reps)
                    for st in completed_sets
                ]
                valid_est_1rms = [val for val in est_1rm_values if val is not None]
                if valid_est_1rms:
                    evidence.append(
                        f"Best estimated 1RM: {max(valid_est_1rms):.1f} kg (Epley estimate)"
                    )

                return ProgressionRecommendationResponse(
                    exercise_slug=slug,
                    exercise_name=name,
                    category="increase_load",
                    headline=f"Consider increasing load (+{increment} kg)",
                    rationale=(
                        f"All {len(completed_sets)} sets cleanly met or exceeded the upper target of {max_rep} reps at {max_w} kg. "
                        "Readiness criteria for standard double-progression are satisfied."
                    ),
                    suggested_action=(
                        f"Increase working weight by approximately {increment} kg next session, "
                        f"aiming for the lower end of the rep range ({min_rep} reps) with strict technique."
                    ),
                    supporting_evidence=evidence,
                    is_advisory=True,
                )

        # Check E: Maintain load (performing within range)
        evidence.append(
            f"All sets completed within target window of {min_rep}-{max_rep} reps."
        )
        return ProgressionRecommendationResponse(
            exercise_slug=slug,
            exercise_name=name,
            category="maintain_load",
            headline="Maintain current load",
            rationale=(
                f"You are successfully training within the target rep range ({min_rep}-{max_rep} reps). "
                f"Continue at this weight until all sets reach {max_rep} reps."
            ),
            suggested_action="Keep current working weight and aim to add 1 additional repetition to your later sets next workout.",
            supporting_evidence=evidence,
            is_advisory=True,
        )

    def get_all_recommendations(
        self, db: Session
    ) -> List[ProgressionRecommendationResponse]:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile first.",
            )

        # Get list of logged exercises
        logged_items = self.list_logged_exercises(db)
        recommendations: List[ProgressionRecommendationResponse] = []

        for item in logged_items:
            history = self.get_exercise_history(db, item.exercise_slug, time_range="all")
            if history.recommendation:
                recommendations.append(history.recommendation)

        return recommendations


workout_analytics_service = WorkoutAnalyticsService()
