from unittest.mock import patch
import pytest
from httpx import AsyncClient

from app.data.generic_foods import GENERIC_FOODS
from app.db.seed_generic_foods import seed_generic_foods
from tests.conftest import TestSessionLocal


def test_seed_generic_foods_idempotency() -> None:
    db = TestSessionLocal()
    try:
        # First run inserts all 75 items
        first_count = seed_generic_foods(db)
        assert first_count == len(GENERIC_FOODS)
        assert first_count >= 50

        # Second run should insert 0 items (idempotent)
        second_count = seed_generic_foods(db)
        assert second_count == 0
    finally:
        db.close()


@pytest.mark.asyncio
async def test_search_generic_staples(client: AsyncClient) -> None:
    db = TestSessionLocal()
    try:
        seed_generic_foods(db)
    finally:
        db.close()

    staples = [
        ("milk", "Milk"),
        ("honey", "Honey"),
        ("oats", "Oats"),
        ("banana", "Banana"),
        ("chicken breast", "Chicken Breast"),
        ("rice", "Rice"),
        ("egg", "Egg"),
        ("flour", "Flour"),
    ]

    for query, expected_substring in staples:
        resp = await client.get(f"/api/foods/search?q={query}&include_external=false")
        assert resp.status_code == 200, f"Search failed for {query}"
        data = resp.json()
        assert len(data) > 0, f"No results found for staple {query}"
        names = [item["name"] for item in data]
        assert any(
            expected_substring.lower() in name.lower() for name in names
        ), f"Expected '{expected_substring}' in results for '{query}', got: {names}"
        # Verify returned schema includes id and generic_usda source
        generic_items = [i for i in data if i.get("source") == "generic_usda"]
        assert len(generic_items) > 0
        assert generic_items[0]["id"] is not None


@pytest.mark.asyncio
async def test_search_offline_resilience(client: AsyncClient) -> None:
    db = TestSessionLocal()
    try:
        seed_generic_foods(db)
    finally:
        db.close()

    # Simulate Open Food Facts network failure / offline
    with patch(
        "app.services.open_food_facts_service.open_food_facts_service.search_foods",
        side_effect=Exception("Network unreachable"),
    ):
        resp = await client.get("/api/foods/search?q=milk&include_external=true")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) > 0
        assert any("Milk" in item["name"] for item in data)


@pytest.mark.asyncio
async def test_search_ranking_prioritizes_exact_match(client: AsyncClient) -> None:
    db = TestSessionLocal()
    try:
        seed_generic_foods(db)
    finally:
        db.close()

    # Create a food with exact name "Honey" to test ranking vs "Honey (pure, raw)"
    await client.post(
        "/api/foods",
        json={
            "name": "Honey",
            "calories_kcal": 304.0,
            "protein_g": 0.3,
            "carbs_g": 82.4,
            "fat_g": 0.0,
        },
    )

    # Search for "Honey"
    resp = await client.get("/api/foods/search?q=honey&include_external=false")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2
    # Exact match "Honey" must be ranked #1
    assert data[0]["name"].lower() == "honey"
    # Prefix match "Honey (pure, raw)" should be ranked next
    assert data[1]["name"].lower().startswith("honey")


@pytest.mark.asyncio
async def test_log_generic_food_with_scaling_and_snapshot(client: AsyncClient) -> None:
    # Setup profile first
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 178.0})

    db = TestSessionLocal()
    try:
        seed_generic_foods(db)
    finally:
        db.close()

    # Find Oats in search
    search_resp = await client.get("/api/foods/search?q=oats&include_external=false")
    assert search_resp.status_code == 200
    results = search_resp.json()
    oats = next(r for r in results if "Oats" in r["name"])

    # Log 50g of oats (half of 100g basis)
    log_payload = {
        "logged_date": "2026-10-23",
        "meal_category": "breakfast",
        "food_id": oats["id"],
        "quantity": 50.0,
        "unit": "g",
    }
    create_log_resp = await client.post("/api/meal-logs", json=log_payload)
    assert create_log_resp.status_code == 201
    log_data = create_log_resp.json()

    # Check scaled nutrients (approx 50% of 100g basis)
    assert log_data["food_name"] == oats["name"]
    expected_calories = round(oats["calories_kcal"] * 0.5, 1)
    assert abs(log_data["calories_kcal"] - expected_calories) <= 0.5
    expected_protein = round(oats["protein_g"] * 0.5, 1)
    assert abs(log_data["protein_g"] - expected_protein) <= 0.5

    # Check snapshot preserves historical values
    assert log_data["food_name"] == oats["name"]
    assert log_data["calories_kcal"] == expected_calories
    assert log_data["protein_g"] == expected_protein

    # Verify that if the food is deleted, historical log remains intact
    del_resp = await client.delete(f"/api/foods/{oats['id']}")
    assert del_resp.status_code == 204

    # Meal log should still exist with all historical snapshot values preserved
    get_log_resp = await client.get("/api/meal-logs/summary?date=2026-10-23")
    assert get_log_resp.status_code == 200
    daily = get_log_resp.json()
    assert daily["total_entries"] == 1
    saved_log = daily["by_category"]["breakfast"][0]
    assert saved_log["food_name"] == oats["name"]
    assert saved_log["calories_kcal"] == expected_calories
    assert saved_log["protein_g"] == expected_protein
    assert saved_log["food_id"] is None  # foreign key safely set to null
