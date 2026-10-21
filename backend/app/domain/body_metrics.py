"""Domain logic and calculations for body composition and measurements."""

from typing import Final

# Plausible range limits for validation and sanity checks
MIN_WEIGHT_KG: Final[float] = 20.0
MAX_WEIGHT_KG: Final[float] = 350.0

MIN_HEIGHT_CM: Final[float] = 50.0
MAX_HEIGHT_CM: Final[float] = 260.0

MIN_BODY_FAT_PCT: Final[float] = 2.0
MAX_BODY_FAT_PCT: Final[float] = 75.0

MIN_BMI: Final[float] = 10.0
MAX_BMI: Final[float] = 80.0

MIN_HEART_RATE_BPM: Final[int] = 30
MAX_HEART_RATE_BPM: Final[int] = 240

MIN_CIRCUMFERENCE_CM: Final[float] = 10.0
MAX_CIRCUMFERENCE_CM: Final[float] = 300.0


def calculate_bmi(
    weight_kg: float | None, height_cm: float | None
) -> float | None:
    """Calculate Body Mass Index (BMI = weight_kg / (height_m ** 2)).

    Returns rounded to 1 decimal place, or None if inputs are invalid or missing.
    """
    if weight_kg is None or height_cm is None:
        return None
    if weight_kg <= 0 or height_cm <= 0:
        return None

    height_m = height_cm / 100.0
    bmi = weight_kg / (height_m**2)
    return round(bmi, 1)


def calculate_fat_mass(
    weight_kg: float | None, body_fat_percentage: float | None
) -> float | None:
    """Calculate absolute fat mass in kg from weight and body fat percentage.

    Returns rounded to 2 decimal places, or None if inputs are invalid or missing.
    """
    if weight_kg is None or body_fat_percentage is None:
        return None
    if weight_kg <= 0 or body_fat_percentage < 0 or body_fat_percentage > 100:
        return None

    fat_mass = weight_kg * (body_fat_percentage / 100.0)
    return round(fat_mass, 2)


def calculate_lean_mass(
    weight_kg: float | None, body_fat_percentage: float | None
) -> float | None:
    """Calculate lean mass in kg from weight and body fat percentage.

    Returns rounded to 2 decimal places, or None if inputs are invalid or missing.
    """
    if weight_kg is None or body_fat_percentage is None:
        return None
    if weight_kg <= 0 or body_fat_percentage < 0 or body_fat_percentage > 100:
        return None

    lean_mass = weight_kg * (1.0 - (body_fat_percentage / 100.0))
    return round(lean_mass, 2)

