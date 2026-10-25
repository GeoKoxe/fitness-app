from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple, Union
import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.exercise import Exercise
from app.models.profile import UserProfile
from app.models.training_profile import TrainingProfile
from app.models.workout_plan import (
    PlannedExercise,
    PlannedWorkoutSession,
    WorkoutPlan,
)
from app.repositories.exercise_repository import exercise_repository
from app.repositories.profile_repository import profile_repository
from app.repositories.training_profile_repository import training_profile_repository
from app.repositories.workout_plan_repository import workout_plan_repository
from app.schemas.training_profile import normalize_duration, parse_tokens
from app.schemas.workout_plan import (
    ExerciseAlternativesResponse,
    WorkoutPlanGenerateRequest,
    WorkoutPlanResponse,
    WorkoutPlanSummaryResponse,
)

WEEKDAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]


class WorkoutPlannerService:
    def _estimate_exercise_duration_minutes(
        self,
        exercise_or_category: Union[Exercise, PlannedExercise, str],
        sets: int,
        rest_seconds: int,
        is_first_exercise: bool,
    ) -> float:
        """Estimate realistic time in minutes needed for an exercise.

        Components:
        - Set execution time: ~45 seconds (0.75 min) per working set.
        - Inter-set rest: (sets - 1) * (rest_seconds / 60.0).
        - Transition / equipment setup: 1.5 min for subsequent exercises.
        - Compound ramp / specific warm-up: 1.5 min for initial compound exercise.
        """
        if isinstance(exercise_or_category, str):
            category = exercise_or_category
        else:
            category = getattr(exercise_or_category, "movement_category", "")

        is_compound = category in {
            "horizontal_push",
            "vertical_push",
            "horizontal_pull",
            "vertical_pull",
            "squat",
            "hinge",
        }
        set_exec_time = sets * 0.75
        inter_set_rest = max(0, sets - 1) * (rest_seconds / 60.0)
        transition = 0.0 if is_first_exercise else 1.5
        ramp = 1.5 if (is_compound and is_first_exercise) else 0.0
        return set_exec_time + inter_set_rest + transition + ramp

    def _calculate_session_duration(
        self,
        session_exercises: List[PlannedExercise],
        duration_minutes: int,
    ) -> float:
        """Calculate total session duration from exercises, sets, rest, transitions, and overhead."""
        if not session_exercises:
            return 0.0
        warmup = 3.0 if duration_minutes <= 20 else 5.0
        cooldown = 2.0 if duration_minutes <= 20 else 3.0
        total = warmup + cooldown
        for idx, ex in enumerate(session_exercises):
            total += self._estimate_exercise_duration_minutes(
                ex.movement_category,
                ex.target_sets,
                ex.rest_seconds,
                is_first_exercise=(idx == 0),
            )
        return total

    def _reduce_session_workload_to_fit(
        self,
        session: PlannedWorkoutSession,
        requested_duration_minutes: int,
    ) -> float:
        """Deterministically reduce planned workload until estimated duration fits within requested duration.

        Reduction policy:
        1. Reduce working sets on accessory exercises (from last to first, index >= 2) down to 2 sets.
        2. Recalculate after each adjustment.
        3. If still exceeding, remove lowest-priority accessory exercises from the end.
        4. If only primary exercises remain and still exceeding, reduce sets on primary exercises down to 2 sets.
        5. If still exceeding, reduce to a single primary exercise with 2 sets (or 1 set if needed).
        6. Recalculate and set session.estimated_duration_minutes = int(round(final_duration)).
        7. If even the minimum viable workout cannot fit, raise HTTPException(400).
        """
        if not session.exercises:
            session.estimated_duration_minutes = 0
            return 0.0

        current_duration = self._calculate_session_duration(
            session.exercises, requested_duration_minutes
        )
        if round(current_duration) <= requested_duration_minutes:
            session.estimated_duration_minutes = int(round(current_duration))
            return current_duration

        # Phase 1: Reduce sets on accessory exercises (from last to first, index >= 2) down to 2 sets
        for _ in range(10):
            if round(current_duration) <= requested_duration_minutes:
                break
            reduced_any = False
            for idx in range(len(session.exercises) - 1, 1, -1):
                ex = session.exercises[idx]
                if ex.target_sets > 2:
                    ex.target_sets -= 1
                    reduced_any = True
                    current_duration = self._calculate_session_duration(
                        session.exercises, requested_duration_minutes
                    )
                    if round(current_duration) <= requested_duration_minutes:
                        break
            if not reduced_any:
                break

        # Phase 2: Remove lowest-priority accessory exercises from the end until only 2 primary exercises remain
        while round(current_duration) > requested_duration_minutes and len(session.exercises) > 2:
            session.exercises.pop()
            current_duration = self._calculate_session_duration(
                session.exercises, requested_duration_minutes
            )

        # Phase 3: Reduce sets on exercise 2 and exercise 1 down to 2 sets
        if round(current_duration) > requested_duration_minutes and len(session.exercises) >= 2:
            ex2 = session.exercises[1]
            while ex2.target_sets > 2 and round(current_duration) > requested_duration_minutes:
                ex2.target_sets -= 1
                current_duration = self._calculate_session_duration(
                    session.exercises, requested_duration_minutes
                )

        if round(current_duration) > requested_duration_minutes and len(session.exercises) >= 1:
            ex1 = session.exercises[0]
            while ex1.target_sets > 2 and round(current_duration) > requested_duration_minutes:
                ex1.target_sets -= 1
                current_duration = self._calculate_session_duration(
                    session.exercises, requested_duration_minutes
                )

        # Phase 4: Remove exercise 2 if still exceeding, leaving only 1 essential primary exercise
        if round(current_duration) > requested_duration_minutes and len(session.exercises) > 1:
            session.exercises.pop()
            current_duration = self._calculate_session_duration(
                session.exercises, requested_duration_minutes
            )

        # Phase 5: If single exercise still exceeds at 2 sets (e.g. 15m with long rest):
        if round(current_duration) > requested_duration_minutes and len(session.exercises) == 1:
            ex1 = session.exercises[0]
            if ex1.target_sets > 1 and round(current_duration) > requested_duration_minutes:
                ex1.target_sets -= 1
                current_duration = self._calculate_session_duration(
                    session.exercises, requested_duration_minutes
                )

        # Re-number order_in_session
        for idx, ex in enumerate(session.exercises):
            ex.order_in_session = idx + 1

        final_duration_rounded = int(round(current_duration))
        if final_duration_rounded > requested_duration_minutes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot fit a viable workout session '{session.session_name}' within {requested_duration_minutes} minutes. "
                    f"Minimum viable workload requires {final_duration_rounded} minutes. Please increase your preferred session duration."
                ),
            )

        # Never report an estimate lower than the calculated workload
        session.estimated_duration_minutes = final_duration_rounded
        return current_duration

    def _determine_prescription(
        self,
        exercise: Exercise,
        experience_level: str,
        goals: List[str],
        slot_index: int,
    ) -> Tuple[int, str, int, str, str]:
        """Determine deterministic sets, reps, rest seconds, progression, and warm-up notes."""
        is_compound = exercise.movement_category in {
            "horizontal_push",
            "vertical_push",
            "horizontal_pull",
            "vertical_pull",
            "squat",
            "hinge",
        }

        # 1. Sets
        if experience_level == "beginner":
            target_sets = 3
        elif experience_level == "advanced":
            target_sets = 4 if (is_compound and slot_index < 3) else 3
        else:  # intermediate
            target_sets = 4 if (is_compound and slot_index < 2) else 3

        # 2. Reps & Rest intervals based on goals
        has_strength = "strength" in goals
        has_hypertrophy = "hypertrophy" in goals
        has_endurance = "endurance" in goals

        if is_compound:
            if has_strength and not has_endurance:
                target_reps = "4-6" if experience_level != "beginner" else "5-8"
                rest_seconds = 150 if experience_level != "beginner" else 120
            elif has_endurance and not has_strength:
                target_reps = "12-15"
                rest_seconds = 60
            elif has_hypertrophy:
                target_reps = "8-10" if slot_index == 0 else "8-12"
                rest_seconds = 90
            else:  # general_fitness or combined
                target_reps = "6-10" if slot_index < 2 else "8-12"
                rest_seconds = 90
        else:
            # Isolation / Core / Accessory
            if has_endurance:
                target_reps = "15-20"
                rest_seconds = 45
            elif has_strength and not has_hypertrophy:
                target_reps = "8-10"
                rest_seconds = 75
            else:
                target_reps = "10-15"
                rest_seconds = 60

        # Special casing for time-based core
        if exercise.slug in {"plank", "side_plank"}:
            target_reps = "30-60s hold"

        # 3. Progression Guidance
        if experience_level == "beginner":
            progression_notes = (
                "Linear progression: When you complete all sets at the top of the rep range "
                "with crisp form, increase resistance by 1-2.5 kg next session."
            )
        elif experience_level == "advanced":
            progression_notes = (
                "RPE 8-9 target (~1-2 reps in reserve). Focus on bar speed and strict tempo. "
                "Utilize periodized wave loading and deload every 4-6 weeks."
            )
        else:  # intermediate
            progression_notes = (
                "Double progression: Add reps first within the target window; increase load "
                "once all prescribed working sets hit the upper rep target."
            )

        # 4. Warm-up Guidance
        if is_compound and slot_index == 0:
            warmup_guidance = (
                "Perform 2-3 progressive warm-up ramp sets (e.g. 50% x 8, 70% x 4, 85% x 2) "
                "before initiating your first working set."
            )
        elif is_compound:
            warmup_guidance = (
                "Perform 1-2 lighter warm-up sets ramping up to your working weight."
            )
        else:
            warmup_guidance = "Specific warm-up optional if target joints are already warmed up."

        return (
            target_sets,
            target_reps,
            rest_seconds,
            progression_notes,
            warmup_guidance,
        )

    def _get_target_slots_for_duration(self, duration_minutes: int) -> int:
        if duration_minutes <= 15:
            return 2
        elif duration_minutes <= 30:
            return 3
        elif duration_minutes <= 45:
            return 4
        elif duration_minutes <= 60:
            return 5
        elif duration_minutes <= 75:
            return 6
        elif duration_minutes <= 90:
            return 7
        elif duration_minutes <= 120:
            return 8
        else:
            return 9

    def _get_session_template(
        self, split_type: str, session_idx: int, slot_count: int = 5
    ) -> Tuple[str, str, List[Dict[str, Any]]]:
        """Return session name, focus, and ordered slot requirements."""
        if split_type == "full_body":
            variants = [
                (
                    "Full Body A",
                    "Quad & Push Emphasis",
                    [
                        {"category": "squat", "muscle": "quadriceps"},
                        {"category": "horizontal_push", "muscle": "chest"},
                        {"category": "horizontal_pull", "muscle": "upper_back"},
                        {"category": "hinge", "muscle": "hamstrings"},
                        {"category": "vertical_push", "muscle": "shoulders"},
                        {"category": "isolation", "muscle": "biceps"},
                        {"category": "core", "muscle": "abdominals"},
                        {"category": "isolation", "muscle": "calves"},
                        {"category": "lunge", "muscle": "quadriceps"},
                        {"category": "core", "muscle": "abdominals"},
                    ],
                ),
                (
                    "Full Body B",
                    "Hinge & Pull Emphasis",
                    [
                        {"category": "hinge", "muscle": "hamstrings"},
                        {"category": "vertical_pull", "muscle": "lats"},
                        {"category": "vertical_push", "muscle": "shoulders"},
                        {"category": "lunge", "muscle": "quadriceps"},
                        {"category": "horizontal_push", "muscle": "chest"},
                        {"category": "isolation", "muscle": "triceps"},
                        {"category": "core", "muscle": "abdominals"},
                        {"category": "horizontal_pull", "muscle": "upper_back"},
                        {"category": "isolation", "muscle": "calves"},
                        {"category": "hinge", "muscle": "glutes"},
                    ],
                ),
                (
                    "Full Body C",
                    "Balanced Hypertrophy",
                    [
                        {"category": "squat", "muscle": "quadriceps"},
                        {"category": "horizontal_pull", "muscle": "lats"},
                        {"category": "horizontal_push", "muscle": "chest"},
                        {"category": "hinge", "muscle": "glutes"},
                        {"category": "isolation", "muscle": "shoulders"},
                        {"category": "isolation", "muscle": "biceps"},
                        {"category": "core", "muscle": "abdominals"},
                        {"category": "isolation", "muscle": "triceps"},
                        {"category": "vertical_push", "muscle": "shoulders"},
                        {"category": "isolation", "muscle": "calves"},
                    ],
                ),
            ]
            template = variants[session_idx % len(variants)]
            return template[0], template[1], template[2][:slot_count]

        elif split_type == "upper_lower":
            variants = [
                (
                    "Upper Body A",
                    "Horizontal Push & Pull",
                    [
                        {"category": "horizontal_push", "muscle": "chest"},
                        {"category": "horizontal_pull", "muscle": "upper_back"},
                        {"category": "vertical_push", "muscle": "shoulders"},
                        {"category": "vertical_pull", "muscle": "lats"},
                        {"category": "isolation", "muscle": "biceps"},
                        {"category": "isolation", "muscle": "triceps"},
                        {"category": "isolation", "muscle": "shoulders"},
                        {"category": "core", "muscle": "abdominals"},
                    ],
                ),
                (
                    "Lower Body A",
                    "Squat & Hamstring Dominant",
                    [
                        {"category": "squat", "muscle": "quadriceps"},
                        {"category": "hinge", "muscle": "hamstrings"},
                        {"category": "lunge", "muscle": "quadriceps"},
                        {"category": "isolation", "muscle": "calves"},
                        {"category": "core", "muscle": "abdominals"},
                        {"category": "hinge", "muscle": "glutes"},
                        {"category": "isolation", "muscle": "hamstrings"},
                    ],
                ),
                (
                    "Upper Body B",
                    "Vertical Push & Pull",
                    [
                        {"category": "vertical_push", "muscle": "shoulders"},
                        {"category": "vertical_pull", "muscle": "lats"},
                        {"category": "horizontal_push", "muscle": "chest"},
                        {"category": "horizontal_pull", "muscle": "upper_back"},
                        {"category": "isolation", "muscle": "triceps"},
                        {"category": "isolation", "muscle": "biceps"},
                        {"category": "isolation", "muscle": "chest"},
                        {"category": "core", "muscle": "abdominals"},
                    ],
                ),
                (
                    "Lower Body B",
                    "Hinge & Posterior Chain",
                    [
                        {"category": "hinge", "muscle": "hamstrings"},
                        {"category": "squat", "muscle": "quadriceps"},
                        {"category": "lunge", "muscle": "glutes"},
                        {"category": "core", "muscle": "abdominals"},
                        {"category": "isolation", "muscle": "calves"},
                        {"category": "hinge", "muscle": "glutes"},
                        {"category": "core", "muscle": "abdominals"},
                    ],
                ),
            ]
            template = variants[session_idx % len(variants)]
            return template[0], template[1], template[2][:slot_count]

        else:  # push_pull_legs
            variants = [
                (
                    "Push Workout",
                    "Chest, Shoulders & Triceps",
                    [
                        {"category": "horizontal_push", "muscle": "chest"},
                        {"category": "vertical_push", "muscle": "shoulders"},
                        {"category": "horizontal_push", "muscle": "chest"},
                        {"category": "isolation", "muscle": "shoulders"},
                        {"category": "isolation", "muscle": "triceps"},
                        {"category": "vertical_push", "muscle": "triceps"},
                        {"category": "core", "muscle": "abdominals"},
                    ],
                ),
                (
                    "Pull Workout",
                    "Back, Rear Delts & Biceps",
                    [
                        {"category": "vertical_pull", "muscle": "lats"},
                        {"category": "horizontal_pull", "muscle": "upper_back"},
                        {"category": "horizontal_pull", "muscle": "lats"},
                        {"category": "isolation", "muscle": "upper_back"},
                        {"category": "isolation", "muscle": "biceps"},
                        {"category": "core", "muscle": "abdominals"},
                    ],
                ),
                (
                    "Legs Workout",
                    "Quads, Hamstrings & Calves",
                    [
                        {"category": "squat", "muscle": "quadriceps"},
                        {"category": "hinge", "muscle": "hamstrings"},
                        {"category": "lunge", "muscle": "quadriceps"},
                        {"category": "hinge", "muscle": "glutes"},
                        {"category": "isolation", "muscle": "calves"},
                        {"category": "core", "muscle": "abdominals"},
                    ],
                ),
            ]
            template = variants[session_idx % len(variants)]
            return template[0], template[1], template[2][:slot_count]

    def generate_plan(
        self, db: Session, req: WorkoutPlanGenerateRequest
    ) -> WorkoutPlanResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile first.",
            )

        training_profile = training_profile_repository.get_by_profile_id(
            db, user_profile.id
        )
        if not training_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Training profile not configured. Please configure your training profile and equipment first.",
            )

        # Parse profile settings
        available_days = parse_tokens(training_profile.available_days)
        raw_equipment = parse_tokens(training_profile.available_equipment)
        available_equipment = set(raw_equipment)
        excluded_exercises = set(parse_tokens(training_profile.excluded_exercises))
        excluded_muscles = set(parse_tokens(training_profile.excluded_muscle_groups))
        experience_level = training_profile.experience_level or "beginner"
        goals = parse_tokens(training_profile.training_goals) or ["general_fitness"]
        duration_minutes = normalize_duration(training_profile.preferred_duration_minutes)

        if not available_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No available training days configured in your training profile.",
            )

        # Bodyweight exercises are always available (requiring zero external equipment)
        effective_equipment = available_equipment.copy()
        effective_equipment.add("bodyweight")

        # Load all eligible exercises from database
        all_exercises = exercise_repository.list_exercises(db, limit=500)
        eligible_exercises: List[Exercise] = []
        for ex in all_exercises:
            if ex.slug in excluded_exercises:
                continue
            if ex.primary_muscle in excluded_muscles:
                continue
            if ex.equipment_required not in effective_equipment:
                continue
            eligible_exercises.append(ex)

        if not eligible_exercises:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"No exercises found matching your configuration. "
                    f"Limiting constraints: available equipment [{', '.join(sorted(available_equipment)) or 'none (bodyweight only)'}], "
                    f"excluded muscle groups [{', '.join(sorted(excluded_muscles)) or 'none'}], "
                    f"excluded exercises [{len(excluded_exercises)}]. "
                    "Please adjust equipment or exclusions."
                ),
            )

        # Determine date span (Monday to Sunday)
        if req.start_date:
            start_date = req.start_date
        else:
            today = date.today()
            start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=6)

        # Determine split type based on available days count
        active_day_count = len(available_days)
        if active_day_count <= 3:
            split_type = "full_body"
        elif active_day_count == 4:
            split_type = "upper_lower"
        else:
            split_type = "push_pull_legs"

        plan_name = req.name or (
            f"7-Day {split_type.replace('_', ' ').title()} Routine"
        )

        # Deactivate existing active plans to preserve historical plans
        workout_plan_repository.deactivate_active_plans(db, user_profile.id)

        # Create Plan record
        settings_snapshot = {
            "experience_level": experience_level,
            "training_goals": goals,
            "available_days": available_days,
            "preferred_duration_minutes": duration_minutes,
            "available_equipment": list(available_equipment),
            "excluded_exercises": list(excluded_exercises),
            "excluded_muscle_groups": list(excluded_muscles),
            "split_type": split_type,
        }

        workout_plan = WorkoutPlan(
            user_profile_id=user_profile.id,
            name=plan_name,
            split_type=split_type,
            start_date=start_date,
            end_date=end_date,
            is_active=True,
            generation_settings=json.dumps(settings_snapshot),
            notes=f"Generated for {experience_level.title()} level, {', '.join(g.title() for g in goals)}.",
        )

        # Track usage to maximize variety across the week
        exercise_usage_count: Dict[int, int] = {ex.id: 0 for ex in eligible_exercises}
        training_session_counter = 0

        # Base overhead for sessions
        warmup_overhead = 3.0 if duration_minutes <= 20 else 5.0
        cooldown_overhead = 2.0 if duration_minutes <= 20 else 3.0
        base_overhead = warmup_overhead + cooldown_overhead

        for day_index in range(7):
            day_name = WEEKDAY_NAMES[day_index]
            session_date = start_date + timedelta(days=day_index)
            is_active_day = day_name in available_days

            if not is_active_day:
                session = PlannedWorkoutSession(
                    day_of_week_index=day_index,
                    day_of_week_name=day_name,
                    plan_date=session_date,
                    is_rest_day=True,
                    session_name="Rest & Recovery",
                    session_focus="Recovery & Adaptation",
                    estimated_duration_minutes=0,
                    warmup_notes="Optional light 15-20 min walk or gentle mobility work.",
                    cooldown_notes=None,
                )
                workout_plan.sessions.append(session)
                continue

            # Active Training Day
            target_slots = self._get_target_slots_for_duration(duration_minutes)
            s_name, s_focus, slots = self._get_session_template(
                split_type, training_session_counter, target_slots
            )
            training_session_counter += 1

            session = PlannedWorkoutSession(
                day_of_week_index=day_index,
                day_of_week_name=day_name,
                plan_date=session_date,
                is_rest_day=False,
                session_name=s_name,
                session_focus=s_focus,
                estimated_duration_minutes=duration_minutes,
                warmup_notes=(
                    f"{int(warmup_overhead)} min dynamic mobility: joint rotations, cat-cow, "
                    "light movements for target muscles."
                ),
                cooldown_notes=f"{int(cooldown_overhead)} min static stretching for muscle groups trained today.",
            )

            # Assign exercises greedily respecting preferred duration limit
            assigned_exercise_ids_in_session: Set[int] = set()
            accumulated_duration = base_overhead

            for slot_idx, slot_req in enumerate(slots):
                cat = slot_req.get("category")
                mus = slot_req.get("muscle")

                # Filter eligible exercises matching this slot
                candidates: List[Exercise] = []
                for ex in eligible_exercises:
                    if ex.id in assigned_exercise_ids_in_session:
                        continue
                    if cat and ex.movement_category == cat:
                        candidates.append(ex)
                    elif mus and ex.primary_muscle == mus:
                        candidates.append(ex)

                if not candidates:
                    candidates = [
                        ex
                        for ex in eligible_exercises
                        if ex.id not in assigned_exercise_ids_in_session
                        and (ex.movement_category == cat or ex.primary_muscle == mus)
                    ]

                if not candidates:
                    candidates = [
                        ex
                        for ex in eligible_exercises
                        if ex.id not in assigned_exercise_ids_in_session
                    ]

                # If no non-duplicate candidates remain in the catalogue
                if not candidates:
                    # If we already have exercises in this session, finish packing
                    if len(session.exercises) > 0:
                        break
                    # Otherwise, no exercise could be found for this session
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Cannot generate session '{s_name}': insufficient eligible exercises matching "
                            f"target pattern ({cat or mus}). "
                            f"Limiting constraints: equipment [{', '.join(sorted(available_equipment)) or 'none (bodyweight only)'}], "
                            f"excluded muscles [{', '.join(sorted(excluded_muscles)) or 'none'}]. "
                            "Please broaden available equipment or reduce exercise exclusions."
                        ),
                    )

                # Deterministic selection: least used across week, built-in preferred, lowest ID
                candidates.sort(
                    key=lambda ex: (
                        exercise_usage_count.get(ex.id, 0),
                        0 if ex.is_built_in else 1,
                        ex.id,
                    )
                )
                chosen = candidates[0]

                # Determine prescription
                sets, reps, rest, prog, warmup = self._determine_prescription(
                    chosen, experience_level, goals, len(session.exercises)
                )

                planned_ex = PlannedExercise(
                    order_in_session=len(session.exercises) + 1,
                    exercise_id=chosen.id,
                    exercise_slug=chosen.slug,
                    exercise_name=chosen.name,
                    primary_muscle=chosen.primary_muscle,
                    secondary_muscles=chosen.secondary_muscles,
                    movement_category=chosen.movement_category,
                    equipment_required=chosen.equipment_required,
                    target_sets=sets,
                    target_reps=reps,
                    rest_seconds=rest,
                    progression_notes=prog,
                    warmup_guidance=warmup,
                )

                tentative_exercises = session.exercises + [planned_ex]
                tentative_duration = self._calculate_session_duration(
                    tentative_exercises, duration_minutes
                )

                if round(tentative_duration) <= duration_minutes or len(session.exercises) == 0:
                    session.exercises.append(planned_ex)
                    assigned_exercise_ids_in_session.add(chosen.id)
                    exercise_usage_count[chosen.id] = (
                        exercise_usage_count.get(chosen.id, 0) + 1
                    )
                else:
                    # Test if adding this exercise with reduced sets (2 sets) fits
                    if sets > 2:
                        planned_ex.target_sets = 2
                        tentative_duration_2sets = self._calculate_session_duration(
                            tentative_exercises, duration_minutes
                        )
                        if round(tentative_duration_2sets) <= duration_minutes:
                            session.exercises.append(planned_ex)
                            assigned_exercise_ids_in_session.add(chosen.id)
                            exercise_usage_count[chosen.id] = (
                                exercise_usage_count.get(chosen.id, 0) + 1
                            )
                            continue
                    # Exceeds maximum preferred duration; stop adding exercises
                    break

            # Deterministically reduce session workload so duration strictly fits
            self._reduce_session_workload_to_fit(session, duration_minutes)

            workout_plan.sessions.append(session)

        # Save and return
        created_plan = workout_plan_repository.create_plan(db, workout_plan)
        return WorkoutPlanResponse.model_validate(created_plan)

    def get_active_plan(self, db: Session) -> Optional[WorkoutPlanResponse]:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            return None
        plan = workout_plan_repository.get_active_plan(db, user_profile.id)
        if not plan:
            return None
        return WorkoutPlanResponse.model_validate(plan)

    def list_plans(
        self, db: Session, skip: int = 0, limit: int = 50
    ) -> List[WorkoutPlanSummaryResponse]:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            return []
        plans = workout_plan_repository.list_plans(
            db, user_profile.id, skip=skip, limit=limit
        )
        return [WorkoutPlanSummaryResponse.model_validate(p) for p in plans]

    def get_plan_by_id(self, db: Session, plan_id: int) -> WorkoutPlanResponse:
        user_profile = profile_repository.get_current_profile(db)
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found.",
            )
        plan = workout_plan_repository.get_plan_by_id(
            db, plan_id, user_profile.id
        )
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workout plan {plan_id} not found",
            )
        return WorkoutPlanResponse.model_validate(plan)

    def get_compatible_alternatives(
        self, db: Session, plan_id: int, planned_exercise_id: int
    ) -> ExerciseAlternativesResponse:
        planned_ex = workout_plan_repository.get_planned_exercise(
            db, planned_exercise_id
        )
        if not planned_ex or planned_ex.session.workout_plan_id != plan_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Planned exercise not found in specified plan",
            )

        user_profile = profile_repository.get_current_profile(db)
        training_profile = (
            training_profile_repository.get_by_profile_id(db, user_profile.id)
            if user_profile
            else None
        )

        available_equipment = (
            set(parse_tokens(training_profile.available_equipment))
            if training_profile
            else set()
        )
        effective_equipment = available_equipment.copy()
        effective_equipment.add("bodyweight")

        excluded_exercises = (
            set(parse_tokens(training_profile.excluded_exercises))
            if training_profile
            else set()
        )
        excluded_muscles = (
            set(parse_tokens(training_profile.excluded_muscle_groups))
            if training_profile
            else set()
        )

        all_exercises = exercise_repository.list_exercises(db, limit=500)
        session_exercise_ids = {
            e.exercise_id for e in planned_ex.session.exercises if e.exercise_id
        }

        compatible = []
        for ex in all_exercises:
            if ex.id == planned_ex.exercise_id:
                continue
            if ex.id in session_exercise_ids:
                continue
            if ex.equipment_required not in effective_equipment:
                continue
            if ex.slug in excluded_exercises:
                continue
            if ex.primary_muscle in excluded_muscles:
                continue
            # Match movement category or primary muscle
            if (
                ex.movement_category == planned_ex.movement_category
                or ex.primary_muscle == planned_ex.primary_muscle
            ):
                compatible.append(ex)

        return ExerciseAlternativesResponse(
            current_planned_exercise_id=planned_ex.id,
            current_exercise_name=planned_ex.exercise_name,
            compatible_alternatives=compatible,
        )

    def replace_exercise(
        self,
        db: Session,
        plan_id: int,
        planned_exercise_id: int,
        new_exercise_id: int,
    ) -> WorkoutPlanResponse:
        planned_ex = workout_plan_repository.get_planned_exercise(
            db, planned_exercise_id
        )
        if not planned_ex or planned_ex.session.workout_plan_id != plan_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Planned exercise not found in specified plan",
            )

        new_ex = exercise_repository.get_by_id(db, new_exercise_id)
        if not new_ex:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise with ID {new_exercise_id} not found in catalogue",
            )

        # Validate against training profile
        user_profile = profile_repository.get_current_profile(db)
        training_profile = (
            training_profile_repository.get_by_profile_id(db, user_profile.id)
            if user_profile
            else None
        )
        if training_profile:
            available_equipment = set(
                parse_tokens(training_profile.available_equipment)
            )
            effective_equipment = available_equipment.copy()
            effective_equipment.add("bodyweight")

            excluded_exercises = set(parse_tokens(training_profile.excluded_exercises))
            excluded_muscles = set(
                parse_tokens(training_profile.excluded_muscle_groups)
            )

            if new_ex.equipment_required not in effective_equipment:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Exercise '{new_ex.name}' requires '{new_ex.equipment_required}', which is not in your available equipment.",
                )
            if new_ex.slug in excluded_exercises:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Exercise '{new_ex.name}' is in your excluded exercises list.",
                )
            if new_ex.primary_muscle in excluded_muscles:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Exercise '{new_ex.name}' targets '{new_ex.primary_muscle}', which is in your excluded muscle groups.",
                )

        # Check for duplication in the same session
        session_exercise_ids = {
            e.exercise_id
            for e in planned_ex.session.exercises
            if e.exercise_id and e.id != planned_ex.id
        }
        if new_ex.id in session_exercise_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Exercise '{new_ex.name}' is already assigned to this workout session.",
            )

        experience_level = (
            training_profile.experience_level if training_profile else "beginner"
        )
        goals = (
            parse_tokens(training_profile.training_goals)
            if training_profile
            else ["general_fitness"]
        )

        sets, reps, rest, prog, warmup = self._determine_prescription(
            new_ex, experience_level, goals, planned_ex.order_in_session - 1
        )

        workout_plan_repository.update_planned_exercise(
            db,
            planned_ex,
            new_ex,
            target_sets=sets,
            target_reps=reps,
            rest_seconds=rest,
            progression_notes=prog,
            warmup_guidance=warmup,
        )

        # Recalculate session workload and enforce duration cap
        session = planned_ex.session
        requested_duration = 60
        if session.workout_plan and session.workout_plan.generation_settings:
            try:
                settings = json.loads(session.workout_plan.generation_settings)
                requested_duration = settings.get("preferred_duration_minutes", 60)
            except Exception:
                pass
        self._reduce_session_workload_to_fit(session, requested_duration)
        db.commit()

        updated_plan = workout_plan_repository.get_plan_by_id(db, plan_id)
        return WorkoutPlanResponse.model_validate(updated_plan)

    def regenerate_exercise(
        self, db: Session, plan_id: int, planned_exercise_id: int
    ) -> WorkoutPlanResponse:
        planned_ex = workout_plan_repository.get_planned_exercise(
            db, planned_exercise_id
        )
        if not planned_ex or planned_ex.session.workout_plan_id != plan_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Planned exercise not found in specified plan",
            )

        alternatives_resp = self.get_compatible_alternatives(
            db, plan_id, planned_exercise_id
        )
        if not alternatives_resp.compatible_alternatives:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No compatible alternative exercise found for '{planned_ex.exercise_name}' matching your equipment and exclusion constraints.",
            )

        candidates = list(alternatives_resp.compatible_alternatives)
        candidates.sort(
            key=lambda ex: (
                0 if ex.is_built_in else 1,
                (
                    0
                    if (
                        planned_ex.exercise
                        and planned_ex.exercise.alternative_exercise_slugs
                        and ex.slug in planned_ex.exercise.alternative_exercise_slugs
                    )
                    else 1
                ),
                ex.id,
            )
        )
        chosen = candidates[0]
        return self.replace_exercise(db, plan_id, planned_exercise_id, chosen.id)


workout_planner_service = WorkoutPlannerService()
