from datetime import date
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.measurement_repository import measurement_repository
from app.repositories.nutrition_goal_repository import nutrition_goal_repository
from app.repositories.profile_repository import profile_repository
from app.schemas.nutrition_goal import (
    GoalEstimateResponse,
    NutritionGoalResponse,
    NutritionGoalUpdate,
)


class NutritionGoalService:
    def get_goals(self, db: Session) -> NutritionGoalResponse:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            return NutritionGoalResponse()

        goal = nutrition_goal_repository.get_by_profile_id(db, profile.id)
        if not goal:
            return NutritionGoalResponse(user_profile_id=profile.id)

        return NutritionGoalResponse.model_validate(goal)

    def update_goals(
        self, db: Session, goal_in: NutritionGoalUpdate
    ) -> NutritionGoalResponse:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile before setting nutrition goals.",
            )

        goal = nutrition_goal_repository.save_or_update(db, profile.id, goal_in)
        return NutritionGoalResponse.model_validate(goal)

    def estimate_goals(self, db: Session) -> GoalEstimateResponse:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile to calculate estimated goals.",
            )

        # 1. Determine Weight (latest measurement or default 70kg)
        latest_m = measurement_repository.get_latest(db, profile.id)
        weight_kg = latest_m.weight_kg if latest_m and latest_m.weight_kg else 70.0

        # 2. Determine Height (profile height or default 175cm)
        height_cm = profile.height_cm or 175.0

        # 3. Determine Age (from date of birth or default 30)
        age = 30
        if profile.date_of_birth:
            today = date.today()
            dob = profile.date_of_birth
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 10 or age > 120:
                age = 30

        # 4. Determine Sex
        is_female = (profile.sex or "").lower() in ("female", "f", "woman")

        # 5. Mifflin-St Jeor BMR
        if is_female:
            bmr = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age - 161.0
        else:
            bmr = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age + 5.0

        bmr = max(round(bmr, 1), 800.0)

        # 6. Physical Activity Multiplier
        activity_factors = {
            "sedentary": 1.2,
            "lightly_active": 1.375,
            "light": 1.375,
            "moderately_active": 1.55,
            "moderate": 1.55,
            "very_active": 1.725,
            "active": 1.725,
            "extra_active": 1.9,
        }
        user_act = (profile.activity_level or "").lower().strip()
        factor = activity_factors.get(user_act, 1.375)

        tdee = round(bmr * factor, 1)

        # 7. Suggested Macro Distribution (25% Protein, 45% Carbs, 30% Fat, 14g Fiber/1000kcal)
        protein_g = round((tdee * 0.25) / 4.0, 1)
        carbs_g = round((tdee * 0.45) / 4.0, 1)
        fat_g = round((tdee * 0.30) / 9.0, 1)
        fiber_g = round((tdee / 1000.0) * 14.0, 1)

        explanation = (
            f"Calculated using the Mifflin-St Jeor equation (BMR: {bmr:.0f} kcal) "
            f"scaled by your activity level factor ({factor}x) for an estimated TDEE of {tdee:.0f} kcal. "
            "Macro split: 25% protein, 45% carbs, 30% fat, and 14g fiber per 1,000 kcal. "
            "This is an optional consumer reference estimate, not a medical prescription. "
            "You can adjust and customize any target."
        )

        return GoalEstimateResponse(
            calories_kcal=tdee,
            protein_g=protein_g,
            carbs_g=carbs_g,
            fat_g=fat_g,
            fiber_g=fiber_g,
            bmr_kcal=bmr,
            tdee_kcal=tdee,
            formula_explanation=explanation,
        )


nutrition_goal_service = NutritionGoalService()
