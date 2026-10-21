from app.domain.body_metrics import (
    calculate_bmi,
    calculate_fat_mass,
    calculate_lean_mass,
)


def test_calculate_bmi():
    # 70 kg, 175 cm -> 70 / (1.75^2) = 22.857... -> 22.9
    assert calculate_bmi(70.0, 175.0) == 22.9
    # Edge cases / missing values
    assert calculate_bmi(None, 175.0) is None
    assert calculate_bmi(70.0, None) is None
    assert calculate_bmi(0, 175.0) is None
    assert calculate_bmi(70.0, 0) is None
    assert calculate_bmi(-70.0, 175.0) is None


def test_calculate_fat_mass():
    # 80 kg, 15% fat -> 12.0 kg
    assert calculate_fat_mass(80.0, 15.0) == 12.0
    # None cases
    assert calculate_fat_mass(None, 15.0) is None
    assert calculate_fat_mass(80.0, None) is None
    assert calculate_fat_mass(80.0, -5.0) is None
    assert calculate_fat_mass(80.0, 105.0) is None


def test_calculate_lean_mass():
    # 80 kg, 15% fat -> 68.0 kg
    assert calculate_lean_mass(80.0, 15.0) == 68.0
    assert calculate_lean_mass(None, 15.0) is None

