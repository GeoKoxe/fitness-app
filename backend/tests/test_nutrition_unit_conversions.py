import pytest

from app.domain.nutrition import (
    calculate_nutrient_scale,
    round_portion_quantity,
    scale_food_nutrients,
    validate_portion_quantity,
)


@pytest.mark.parametrize(
    "quantity,unit,expected",
    [
        # Grams / milliliters (multiples of 5, minimum 5)
        (23.0, "g", 25.0),
        (25.0, "g", 25.0),
        (2.0, "g", 5.0),  # Clamped to minimum 5
        (150.0, "ml", 150.0),
        (148.0, "ml", 150.0),
        (147.0, "ml", 145.0),
        # Kilograms (preserves unit, rounds corresponding grams to multiple of 5)
        (0.5, "kg", 0.5),  # 500g -> 500g -> 0.5kg
        (0.252, "kg", 0.25),  # 252g -> 250g -> 0.25kg
        (0.253, "kg", 0.255),  # 253g -> 255g -> 0.255kg
        (0.001, "kg", 0.005),  # 1g -> min 5g -> 0.005kg
        (1.234, "kilograms", 1.235),  # 1234g -> 1235g -> 1.235kg
        # Liters (preserves unit, rounds corresponding ml to multiple of 5)
        (1.0, "l", 1.0),  # 1000ml -> 1000ml -> 1.0l
        (0.25, "l", 0.25),  # 250ml -> 250ml -> 0.25l
        (0.333, "liters", 0.335),  # 333ml -> 335ml -> 0.335l
        (0.002, "liter", 0.005),  # 2ml -> min 5ml -> 0.005l
        # Count-based units (whole integers, minimum 1)
        (1.4, "serving", 1.0),
        (1.6, "serving", 2.0),
        (0.2, "egg", 1.0),  # Clamped to minimum 1
        (3.0, "piece", 3.0),
        # Edge cases: 0 and negative
        (0.0, "g", 0.0),
        (-5.0, "g", 0.0),
        (0.0, "kg", 0.0),
        (-0.5, "kg", 0.0),
        (0.0, "l", 0.0),
        (-1.0, "l", 0.0),
    ],
)
def test_round_portion_quantity_across_units(quantity, unit, expected):
    result = round_portion_quantity(quantity, unit)
    assert result == expected


@pytest.mark.parametrize(
    "quantity,unit,is_valid",
    [
        # Grams / ml valid (multiples of 5)
        (25.0, "g", True),
        (150.0, "ml", True),
        # Grams / ml invalid
        (23.0, "g", False),
        (12.5, "ml", False),
        (0.0, "g", False),
        (-10.0, "g", False),
        # Kilograms valid (corresponds to multiple of 5g)
        (0.5, "kg", True),  # 500g
        (0.025, "kg", True),  # 25g
        (1.25, "kilograms", True),  # 1250g
        (0.005, "kg", True),  # 5g
        # Kilograms invalid
        (0.003, "kg", False),  # 3g -> not multiple of 5
        (0.252, "kg", False),  # 252g -> not multiple of 5
        (0.0, "kg", False),
        (-0.5, "kg", False),
        # Liters valid (corresponds to multiple of 5ml)
        (1.0, "l", True),  # 1000ml
        (0.25, "l", True),  # 250ml
        (0.005, "liters", True),  # 5ml
        # Liters invalid
        (0.333, "l", False),  # 333ml
        (0.0, "l", False),
        (-1.0, "l", False),
        # Count units valid (whole numbers)
        (1.0, "serving", True),
        (2.0, "egg", True),
        # Count units invalid
        (1.5, "serving", False),
        (0.0, "piece", False),
        (-2.0, "unit", False),
    ],
)
def test_validate_portion_quantity_across_units(quantity, unit, is_valid):
    valid, msg = validate_portion_quantity(quantity, unit)
    assert valid is is_valid
    if not is_valid:
        assert msg is not None


def test_kilogram_and_gram_nutrition_equivalence():
    """Verify that 0.5 kg of chicken breast produces exactly identical nutrition to 500 g."""
    # Chicken breast: 165 kcal, 31g protein, 0g carbs, 3.6g fat per 100g
    nutrients_500g = scale_food_nutrients(
        calories_kcal=165.0,
        protein_g=31.0,
        carbs_g=0.0,
        fat_g=3.6,
        quantity=500.0,
        nutritional_basis="100g",
        unit="g",
    )

    nutrients_half_kg = scale_food_nutrients(
        calories_kcal=165.0,
        protein_g=31.0,
        carbs_g=0.0,
        fat_g=3.6,
        quantity=0.5,
        nutritional_basis="100g",
        unit="kg",
    )

    assert nutrients_500g == nutrients_half_kg
    assert nutrients_half_kg["calories_kcal"] == 825.0
    assert nutrients_half_kg["protein_g"] == 155.0
    assert nutrients_half_kg["fat_g"] == 18.0


def test_liter_and_milliliter_nutrition_equivalence():
    """Verify that 0.25 l of whole milk produces exactly identical nutrition to 250 ml."""
    # Whole milk: 64 kcal, 3.3g protein, 4.8g carbs, 3.6g fat per 100ml
    nutrients_250ml = scale_food_nutrients(
        calories_kcal=64.0,
        protein_g=3.3,
        carbs_g=4.8,
        fat_g=3.6,
        quantity=250.0,
        nutritional_basis="100ml",
        unit="ml",
    )

    nutrients_quarter_l = scale_food_nutrients(
        calories_kcal=64.0,
        protein_g=3.3,
        carbs_g=4.8,
        fat_g=3.6,
        quantity=0.25,
        nutritional_basis="100ml",
        unit="l",
    )

    assert nutrients_250ml == nutrients_quarter_l
    assert nutrients_quarter_l["calories_kcal"] == 160.0
    assert nutrients_quarter_l["protein_g"] == 8.2
    assert nutrients_quarter_l["carbs_g"] == 12.0
    assert nutrients_quarter_l["fat_g"] == 9.0


def test_calculate_nutrient_scale_zero_and_none():
    """Verify handling of zero, negative, and None nutrient values."""
    assert calculate_nutrient_scale(None, 100.0, "100g", "g") is None
    assert calculate_nutrient_scale(150.0, 0.0, "100g", "g") == 0.0
    assert calculate_nutrient_scale(150.0, -10.0, "100g", "g") == 0.0
    assert calculate_nutrient_scale(150.0, 0.0, "100g", "kg") == 0.0
    assert calculate_nutrient_scale(150.0, -0.5, "100g", "kg") == 0.0

