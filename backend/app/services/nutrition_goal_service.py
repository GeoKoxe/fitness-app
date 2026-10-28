from datetime import date
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.measurement_repository import measurement_repository
from app.repositories.nutrition_goal_repository import nutrition_goal_repository
from app.repositories.profile_repository import profile_repository
from app.repositories.training_profile_repository import training_profile_repository
from app.schemas.nutrition_goal import (
    GenerateGoalsResponse,
    GeneratedProfile,
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

    def generate_goal_profiles(self, db: Session) -> GenerateGoalsResponse:
        profile = profile_repository.get_current_profile(db)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User profile not found. Please create a user profile before generating nutrition goals.",
            )

        # Validate required fields
        latest_m = measurement_repository.get_latest(db, profile.id)
        if not latest_m or not latest_m.weight_kg or latest_m.weight_kg <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Body weight is required to calculate personalized nutrition goals. Please record your weight in Body & Measurements.",
            )
        weight_kg = latest_m.weight_kg

        if not profile.height_cm or profile.height_cm <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Height is required to calculate basal metabolic rate. Please specify your height in your profile.",
            )
        height_cm = profile.height_cm

        if not profile.date_of_birth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Date of birth is required to calculate age and metabolic expenditure. Please set your date of birth in your profile.",
            )
        today = date.today()
        dob = profile.date_of_birth
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if age < 12 or age > 120:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Age ({age}) must be between 12 and 120 years for valid metabolic calculation.",
            )

        if not profile.sex:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Biological sex is required to calculate basal metabolic rate using Mifflin-St Jeor. Please set your sex in your profile.",
            )
        sex_str = profile.sex.strip().lower()
        is_female = sex_str in ("female", "f", "woman")

        # 1. Mifflin-St Jeor BMR
        if is_female:
            bmr = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age - 161.0
        else:
            bmr = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age + 5.0
        bmr = max(round(bmr, 1), 800.0)

        # 2. Activity & Training factor
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
        user_act = (profile.activity_level or "moderately_active").lower().strip()
        base_factor = activity_factors.get(user_act, 1.375)

        # Account for training profile
        training_prof = training_profile_repository.get_by_profile_id(db, profile.id)
        training_days = 0
        training_goals_str = None
        if training_prof:
            if training_prof.available_days:
                days = [d.strip() for d in training_prof.available_days.split(",") if d.strip()]
                training_days = len(days)
            training_goals_str = training_prof.training_goals

        # Effective TDEE multiplier accounting for scheduled training days
        training_adjustment = max(0.0, (training_days - 2) * 0.04) if training_days > 2 else 0.0
        effective_factor = round(min(1.95, base_factor + training_adjustment), 3)
        tdee = round(bmr * effective_factor)

        def make_profile(
            key: str,
            name: str,
            target_cals: float,
            protein_multiplier: float,
            fat_ratio: float,
            purpose: str,
            explanation: str,
        ) -> GeneratedProfile:
            # Whole-number protein (grams)
            prot = round(weight_kg * protein_multiplier)
            # Whole-number fat (grams)
            fat = round((target_cals * fat_ratio) / 9.0)
            # Reconcile carbs so 4*P + 4*C + 9*F == target_cals exactly
            carb_cals = max(0.0, target_cals - (4.0 * prot + 9.0 * fat))
            carbs = round(carb_cals / 4.0)
            # Recalculate exact total calories so 4P + 4C + 9F is 100% consistent with macro sum
            exact_cals = 4.0 * prot + 4.0 * carbs + 9.0 * fat
            fiber = round((exact_cals / 1000.0) * 14.0)

            p_pct = round((4.0 * prot / exact_cals) * 100.0, 1) if exact_cals > 0 else 0.0
            c_pct = round((4.0 * carbs / exact_cals) * 100.0, 1) if exact_cals > 0 else 0.0
            f_pct = round((9.0 * fat / exact_cals) * 100.0, 1) if exact_cals > 0 else 0.0

            return GeneratedProfile(
                key=key,
                name=name,
                calories_kcal=float(exact_cals),
                protein_g=float(prot),
                carbs_g=float(carbs),
                fat_g=float(fat),
                fiber_g=float(fiber),
                protein_pct=p_pct,
                carbs_pct=c_pct,
                fat_pct=f_pct,
                purpose=purpose,
                explanation=explanation,
            )

        # 3 Profiles:
        # 1. Weight Loss: 20% deficit, bounded by BMR, 2.0 g/kg protein, 25% fat
        loss_cals = max(round(tdee * 0.80), round(bmr))
        p_loss = make_profile(
            key="weight_loss",
            name="Weight Loss",
            target_cals=loss_cals,
            protein_multiplier=2.0,
            fat_ratio=0.25,
            purpose="Fat loss while preserving lean muscle mass",
            explanation=f"Calculated with a moderate 20% deficit ({loss_cals} kcal, bounded by BMR {bmr:.0f} kcal) and elevated protein (2.0g/kg) to protect lean tissue.",
        )

        # 2. Sustainability: Maintenance at TDEE, 1.8 g/kg protein, 28% fat
        p_sustain = make_profile(
            key="sustainability",
            name="Sustainability",
            target_cals=tdee,
            protein_multiplier=1.8,
            fat_ratio=0.28,
            purpose="Energy balance, maintenance, and long-term adherence",
            explanation=f"Matches your estimated daily expenditure ({tdee} kcal) with balanced macronutrients (1.8g/kg protein, 28% fat, remaining carbs).",
        )

        # 3. Bulking: +12% surplus, 1.8 g/kg protein, 25% fat
        bulk_cals = round(tdee * 1.12)
        p_bulk = make_profile(
            key="bulking",
            name="Bulking",
            target_cals=bulk_cals,
            protein_multiplier=1.8,
            fat_ratio=0.25,
            purpose="Controlled surplus for hypertrophy and muscle growth",
            explanation=f"Provides a controlled +12% surplus ({bulk_cals} kcal) with high carbohydrate availability to fuel resistance training and muscle protein synthesis.",
        )

        formula_exp = (
            f"Derived via Mifflin-St Jeor formula (BMR: {bmr:.0f} kcal) adjusted by an activity/training multiplier of "
            f"{effective_factor:.2f}x ({user_act}, {training_days} training days/week), yielding an estimated TDEE of {tdee:.0f} kcal. "
            f"All macro targets are strictly reconciled to total calories (4 kcal/g protein & carbs, 9 kcal/g fat)."
        )
        disclaimer = "These recommendations are non-clinical nutritional guidelines for consumer reference only and do not replace personalized medical advice."

        return GenerateGoalsResponse(
            bmr_kcal=bmr,
            tdee_kcal=float(tdee),
            weight_kg=float(weight_kg),
            height_cm=float(height_cm),
            age=age,
            sex=profile.sex,
            activity_level=profile.activity_level or "moderately_active",
            training_days_per_week=training_days,
            training_goals=training_goals_str,
            profiles=[p_loss, p_sustain, p_bulk],
            formula_explanation=formula_exp,
            disclaimer=disclaimer,
        )

    def estimate_goals(self, db: Session) -> GoalEstimateResponse:
        # Try generating standard profiles first
        try:
            gen_resp = self.generate_goal_profiles(db)
            sustain = next(p for p in gen_resp.profiles if p.key == "sustainability")
            return GoalEstimateResponse(
                calories_kcal=sustain.calories_kcal,
                protein_g=sustain.protein_g,
                carbs_g=sustain.carbs_g,
                fat_g=sustain.fat_g,
                fiber_g=sustain.fiber_g,
                bmr_kcal=gen_resp.bmr_kcal,
                tdee_kcal=gen_resp.tdee_kcal,
                formula_explanation=gen_resp.formula_explanation,
                profiles=gen_resp.profiles,
            )
        except HTTPException:
            # Fallback with profile defaults if required fields are missing
            profile = profile_repository.get_current_profile(db)
            if not profile:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User profile not found. Please create a user profile to calculate estimated goals.",
                )
            latest_m = measurement_repository.get_latest(db, profile.id)
            weight_kg = latest_m.weight_kg if latest_m and latest_m.weight_kg else 70.0
            height_cm = profile.height_cm or 175.0
            age = 30
            if profile.date_of_birth:
                today = date.today()
                dob = profile.date_of_birth
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age < 10 or age > 120:
                    age = 30
            is_female = (profile.sex or "").lower() in ("female", "f", "woman")
            if is_female:
                bmr = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age - 161.0
            else:
                bmr = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age + 5.0
            bmr = max(round(bmr, 1), 800.0)
            tdee = round(bmr * 1.375)
            protein_g = round((tdee * 0.25) / 4.0)
            carbs_g = round((tdee * 0.45) / 4.0)
            fat_g = round((tdee * 0.30) / 9.0)
            fiber_g = round((tdee / 1000.0) * 14.0)
            exact_cals = 4.0 * protein_g + 4.0 * carbs_g + 9.0 * fat_g

            return GoalEstimateResponse(
                calories_kcal=float(exact_cals),
                protein_g=float(protein_g),
                carbs_g=float(carbs_g),
                fat_g=float(fat_g),
                fiber_g=float(fiber_g),
                bmr_kcal=bmr,
                tdee_kcal=float(tdee),
                formula_explanation="Estimated fallback targets based on available profile information.",
                profiles=None,
            )


nutrition_goal_service = NutritionGoalService()
