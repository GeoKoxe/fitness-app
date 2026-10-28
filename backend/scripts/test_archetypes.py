"""Simulate enhanced CandidateMealGenerator with portion archetypes and macro-aware candidate generation."""

import sys
sys.path.insert(0, "backend")

from typing import Dict, List, Any
from app.data.built_in_recipes import BUILT_IN_RECIPES
from app.data.generic_foods import GENERIC_FOODS
from app.models.recipe import Recipe, RecipeIngredient
from app.models.food import Food
from app.domain.nutrition import scale_food_nutrients

def build_mock_foods():
    food_by_ext = {}
    for i, f in enumerate(GENERIC_FOODS, start=1):
        food_obj = Food(
            id=i,
            external_id=f["external_id"],
            name=f["name"],
            category=f.get("category", "Other"),
            calories_kcal=f["calories_kcal"],
            protein_g=f["protein_g"],
            carbs_g=f["carbs_g"],
            fat_g=f["fat_g"],
            fiber_g=f.get("fiber_g"),
            nutritional_basis=f.get("nutritional_basis", "per_100g"),
            serving_quantity=f.get("serving_quantity"),
            serving_unit=f.get("serving_unit"),
        )
        food_by_ext[f["external_id"]] = food_obj
    return food_by_ext

if __name__ == "__main__":
    print("Test foods loaded successfully.")

