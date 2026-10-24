"""Domain calculations and scaling logic for food and nutrition."""

from typing import Dict, Optional, Tuple


def calculate_nutrient_scale(
    base_nutrient: Optional[float],
    quantity: float,
    nutritional_basis: str,
    unit: str,
    serving_quantity: Optional[float] = None,
) -> Optional[float]:
    """Calculate scaled nutrient value based on consumed quantity and food basis.

    - If basis is '100g' and unit is 'g': scale = quantity / 100.0
    - If basis is '100ml' and unit is 'ml': scale = quantity / 100.0
    - If unit is 'serving' and food basis is 'serving': scale = quantity
    - If unit is 'serving' and food basis is '100g' with serving_quantity: scale = (quantity * serving_quantity) / 100.0
    - Returns None if base_nutrient is None (preserves unknown nutrients).
    """
    if base_nutrient is None:
        return None
    if quantity <= 0:
        return 0.0

    basis_clean = (nutritional_basis or "100g").lower().strip()
    unit_clean = (unit or "g").lower().strip()

    factor = 1.0
    if unit_clean in ("g", "grams"):
        if "100g" in basis_clean or "100" in basis_clean:
            factor = quantity / 100.0
        elif serving_quantity and serving_quantity > 0 and "serving" in basis_clean:
            factor = quantity / serving_quantity
        else:
            factor = quantity / 100.0
    elif unit_clean in ("ml", "milliliters"):
        if "100ml" in basis_clean or "100" in basis_clean:
            factor = quantity / 100.0
        elif serving_quantity and serving_quantity > 0 and "serving" in basis_clean:
            factor = quantity / serving_quantity
        else:
            factor = quantity / 100.0
    elif unit_clean in ("serving", "servings", "portion", "portions"):
        if "serving" in basis_clean:
            factor = quantity
        elif serving_quantity and serving_quantity > 0:
            factor = (quantity * serving_quantity) / 100.0
        else:
            factor = quantity
    else:
        # Fallback to standard 100-basis scaling
        factor = quantity / 100.0

    return round(base_nutrient * factor, 2)


def scale_food_nutrients(
    calories_kcal: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    quantity: float,
    nutritional_basis: str,
    unit: str,
    fiber_g: Optional[float] = None,
    sugar_g: Optional[float] = None,
    saturated_fat_g: Optional[float] = None,
    sodium_mg: Optional[float] = None,
    serving_quantity: Optional[float] = None,
) -> Dict[str, Optional[float]]:
    """Calculates all scaled nutrients for a given food and consumed quantity."""
    calc = lambda val, digits=2: round(val, digits) if val is not None else None

    scaled_cal = calculate_nutrient_scale(calories_kcal, quantity, nutritional_basis, unit, serving_quantity)
    scaled_protein = calculate_nutrient_scale(protein_g, quantity, nutritional_basis, unit, serving_quantity)
    scaled_carbs = calculate_nutrient_scale(carbs_g, quantity, nutritional_basis, unit, serving_quantity)
    scaled_fat = calculate_nutrient_scale(fat_g, quantity, nutritional_basis, unit, serving_quantity)

    scaled_fiber = calculate_nutrient_scale(fiber_g, quantity, nutritional_basis, unit, serving_quantity)
    scaled_sugar = calculate_nutrient_scale(sugar_g, quantity, nutritional_basis, unit, serving_quantity)
    scaled_sat_fat = calculate_nutrient_scale(saturated_fat_g, quantity, nutritional_basis, unit, serving_quantity)
    scaled_sodium = calculate_nutrient_scale(sodium_mg, quantity, nutritional_basis, unit, serving_quantity)

    return {
        "calories_kcal": calc(scaled_cal, 1) or 0.0,
        "protein_g": calc(scaled_protein, 1) or 0.0,
        "carbs_g": calc(scaled_carbs, 1) or 0.0,
        "fat_g": calc(scaled_fat, 1) or 0.0,
        "fiber_g": calc(scaled_fiber, 1),
        "sugar_g": calc(scaled_sugar, 1),
        "saturated_fat_g": calc(scaled_sat_fat, 1),
        "sodium_mg": calc(scaled_sodium, 1),
    }


def round_portion_quantity(quantity: float, unit: str) -> float:
    """Enforce whole multiples of 5 for weight/volume, and whole integers for count-based units.

    - Weight (g, grams, ml, milliliters): positive whole-number multiple of 5 (e.g. 20g, 25g, 150g).
    - Count (serving, piece, unit, egg, banana): positive whole integer (1, 2, 3...).
    """
    if quantity <= 0:
        return 0.0

    unit_clean = (unit or "g").lower().strip()
    if unit_clean in ("g", "grams", "gram", "ml", "milliliters", "milliliter"):
        rounded = round(quantity / 5.0) * 5
        return float(max(5, int(rounded)))
    elif unit_clean in ("kg", "kilograms", "l", "liters", "liter"):
        rounded = round(quantity * 1000.0 / 5.0) * 5
        return float(max(5, int(rounded)))
    else:
        # Count-based units: whole counts (e.g. 1 egg, 2 bananas, 1 serving)
        return float(max(1, int(round(quantity))))


def validate_portion_quantity(quantity: float, unit: str) -> Tuple[bool, Optional[str]]:
    """Validate that a meal-planner ingredient quantity adheres to portion rules.

    Returns (is_valid, error_message).
    """
    if quantity <= 0:
        return False, "Quantity must be greater than 0."

    unit_clean = (unit or "g").lower().strip()
    if unit_clean in ("g", "grams", "gram", "ml", "milliliters", "milliliter"):
        if quantity % 5 != 0 or int(quantity) != quantity:
            return False, f"Weight/volume quantity must be a whole-number multiple of 5 (e.g. 25 {unit}, 150 {unit}). Got {quantity}."
    else:
        if int(quantity) != quantity:
            return False, f"Count-based ingredients must be whole counts (e.g. 1, 2). Got {quantity}."

    return True, None


