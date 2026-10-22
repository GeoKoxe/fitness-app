from unittest.mock import MagicMock, patch
import pytest
from httpx import AsyncClient, Response


@pytest.mark.asyncio
async def test_create_custom_food_valid(client: AsyncClient):
    payload = {
        "name": "Greek Yogurt 2%",
        "brand": "Fage",
        "category": "Dairy",
        "nutritional_basis": "100g",
        "serving_description": "1 cup",
        "serving_quantity": 200.0,
        "serving_unit": "g",
        "calories_kcal": 73.0,
        "protein_g": 9.9,
        "carbs_g": 3.9,
        "fat_g": 2.0,
        "sugar_g": 3.9,
        "sodium_mg": 45.0,
        "is_favorite": True,
    }
    res = await client.post("/api/foods", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] is not None
    assert data["name"] == "Greek Yogurt 2%"
    assert data["calories_kcal"] == 73.0
    assert data["fiber_g"] is None  # Optional nutrient remains None, not 0
    assert data["is_favorite"] is True


@pytest.mark.asyncio
async def test_create_food_validation_errors(client: AsyncClient):
    # Empty name
    res1 = await client.post(
        "/api/foods",
        json={"name": "   ", "calories_kcal": 100, "protein_g": 10, "carbs_g": 10, "fat_g": 2},
    )
    assert res1.status_code == 422

    # Negative calories
    res2 = await client.post(
        "/api/foods",
        json={"name": "Oats", "calories_kcal": -50, "protein_g": 10, "carbs_g": 10, "fat_g": 2},
    )
    assert res2.status_code == 422

    # Negative protein
    res3 = await client.post(
        "/api/foods",
        json={"name": "Oats", "calories_kcal": 150, "protein_g": -1, "carbs_g": 10, "fat_g": 2},
    )
    assert res3.status_code == 422


@pytest.mark.asyncio
async def test_food_listing_pagination_and_favorites(client: AsyncClient):
    # Create 3 foods
    for i in range(3):
        await client.post(
            "/api/foods",
            json={
                "name": f"Food {i}",
                "calories_kcal": 100.0 + i,
                "protein_g": 5.0,
                "carbs_g": 10.0,
                "fat_g": 2.0,
                "is_favorite": (i == 1),
            },
        )

    res = await client.get("/api/foods?page=1&page_size=2")
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert len(data["items"]) == 2

    fav_res = await client.get("/api/foods?favorites_only=true")
    assert fav_res.status_code == 200
    fav_data = fav_res.json()
    assert all(item["is_favorite"] is True for item in fav_data["items"])


@pytest.mark.asyncio
async def test_toggle_favorite_and_update(client: AsyncClient):
    create_res = await client.post(
        "/api/foods",
        json={"name": "Banana", "calories_kcal": 89.0, "protein_g": 1.1, "carbs_g": 22.8, "fat_g": 0.3},
    )
    food_id = create_res.json()["id"]

    # Toggle favorite
    toggle_res = await client.post(f"/api/foods/{food_id}/toggle-favorite")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_favorite"] is True

    # Update food
    update_res = await client.patch(
        f"/api/foods/{food_id}",
        json={"brand": "Chiquita", "fiber_g": 2.6},
    )
    assert update_res.status_code == 200
    assert update_res.json()["brand"] == "Chiquita"
    assert update_res.json()["fiber_g"] == 2.6


@pytest.mark.asyncio
async def test_search_foods_with_mocked_open_food_facts(client: AsyncClient):
    # Pre-create a local food
    await client.post(
        "/api/foods",
        json={"name": "Local Greek Honey", "calories_kcal": 304, "protein_g": 0.3, "carbs_g": 82.4, "fat_g": 0.0},
    )

    # Mock Open Food Facts HTTP response
    mock_off_response = {
        "products": [
            {
                "product_name": "Attiki Greek Honey",
                "brands": "Attiki",
                "code": "5201054011234",
                "nutriments": {
                    "energy-kcal_100g": 320.0,
                    "proteins_100g": 0.2,
                    "carbohydrates_100g": 80.0,
                    "fat_100g": 0.0,
                    "sugars_100g": 78.0,
                },
                "nutrition_data_per": "100g",
            }
        ]
    }

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_off_response
        mock_get.return_value = mock_resp

        res = await client.get("/api/foods/search?q=honey")
        assert res.status_code == 200
        results = res.json()
        assert len(results) >= 2
        names = [r["name"] for r in results]
        assert "Local Greek Honey" in names
        assert "Attiki Greek Honey" in names


@pytest.mark.asyncio
async def test_search_gracefully_handles_external_api_failure(client: AsyncClient):
    # When external OFF request throws connection error, local results still return without crashing
    await client.post(
        "/api/foods",
        json={"name": "Oat Milk Barista", "calories_kcal": 59, "protein_g": 1.0, "carbs_g": 6.5, "fat_g": 3.0},
    )

    with patch("httpx.Client.get", side_effect=Exception("Connection refused")):
        res = await client.get("/api/foods/search?q=Oat")
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Oat Milk Barista"

