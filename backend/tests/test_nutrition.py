from datetime import date
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_log_meal_scaling_and_daily_summary(client: AsyncClient):
    # Setup profile
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 178.0})

    # Create food: 100g basis -> 200 kcal, 20g protein, 10g carbs, 5g fat, 3g fiber
    food_res = await client.post(
        "/api/foods",
        json={
            "name": "Chicken Breast Cooked",
            "nutritional_basis": "100g",
            "calories_kcal": 165.0,
            "protein_g": 31.0,
            "carbs_g": 0.0,
            "fat_g": 3.6,
        },
    )
    food_id = food_res.json()["id"]

    today = date.today().isoformat()

    # Log 150g for Lunch: scale = 1.5
    # Calories = 165 * 1.5 = 247.5
    # Protein = 31 * 1.5 = 46.5
    # Fat = 3.6 * 1.5 = 5.4
    log_res = await client.post(
        "/api/meal-logs",
        json={
            "logged_date": today,
            "meal_category": "lunch",
            "food_id": food_id,
            "quantity": 150.0,
            "unit": "g",
            "notes": "Post-workout lunch",
        },
    )
    assert log_res.status_code == 201
    log_data = log_res.json()
    assert log_data["food_name"] == "Chicken Breast Cooked"
    assert log_data["calories_kcal"] == 247.5
    assert log_data["protein_g"] == 46.5
    assert log_data["carbs_g"] == 0.0
    assert log_data["fat_g"] == 5.4

    # Verify daily summary
    summary_res = await client.get(f"/api/meal-logs/summary?date={today}")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["totals"]["calories_kcal"] == 247.5
    assert summary["totals"]["protein_g"] == 46.5
    assert len(summary["by_category"]["lunch"]) == 1
    assert len(summary["by_category"]["breakfast"]) == 0


@pytest.mark.asyncio
async def test_historical_snapshot_preserved_when_food_edited_or_deleted(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 178.0})

    food_res = await client.post(
        "/api/foods",
        json={
            "name": "Original Granola",
            "nutritional_basis": "100g",
            "calories_kcal": 450.0,
            "protein_g": 10.0,
            "carbs_g": 60.0,
            "fat_g": 18.0,
        },
    )
    food_id = food_res.json()["id"]
    today = date.today().isoformat()

    # Log 100g Granola
    log_res = await client.post(
        "/api/meal-logs",
        json={
            "logged_date": today,
            "meal_category": "breakfast",
            "food_id": food_id,
            "quantity": 100.0,
            "unit": "g",
        },
    )
    log_id = log_res.json()["id"]
    assert log_res.json()["calories_kcal"] == 450.0

    # 1. Edit food recipe in catalogue
    await client.patch(
        f"/api/foods/{food_id}",
        json={"calories_kcal": 350.0, "name": "New Recipe Granola"},
    )

    # 2. Historical log must NOT change its snapshot values
    log_check = await client.get(f"/api/meal-logs/{log_id}")
    assert log_check.status_code == 200
    assert log_check.json()["calories_kcal"] == 450.0
    assert log_check.json()["food_name"] == "Original Granola"

    # 3. Delete food from catalogue
    del_res = await client.delete(f"/api/foods/{food_id}")
    assert del_res.status_code == 204

    # 4. Historical log MUST STILL EXIST and preserve all nutrients
    log_after_del = await client.get(f"/api/meal-logs/{log_id}")
    assert log_after_del.status_code == 200
    assert log_after_del.json()["food_name"] == "Original Granola"
    assert log_after_del.json()["calories_kcal"] == 450.0
    assert log_after_del.json()["food_id"] is None


@pytest.mark.asyncio
async def test_update_log_quantity_rescales_snapshot(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 178.0})

    food_res = await client.post(
        "/api/foods",
        json={
            "name": "Brown Rice",
            "nutritional_basis": "100g",
            "calories_kcal": 130.0,
            "protein_g": 2.7,
            "carbs_g": 28.0,
            "fat_g": 1.0,
        },
    )
    food_id = food_res.json()["id"]
    today = date.today().isoformat()

    log_res = await client.post(
        "/api/meal-logs",
        json={
            "logged_date": today,
            "meal_category": "dinner",
            "food_id": food_id,
            "quantity": 100.0,
            "unit": "g",
        },
    )
    log_id = log_res.json()["id"]
    assert log_res.json()["calories_kcal"] == 130.0

    # Double quantity to 200g
    update_res = await client.patch(
        f"/api/meal-logs/{log_id}",
        json={"quantity": 200.0},
    )
    assert update_res.status_code == 200
    assert update_res.json()["calories_kcal"] == 260.0
    assert update_res.json()["carbs_g"] == 56.0


@pytest.mark.asyncio
async def test_nutrition_backup_export_and_import(client: AsyncClient):
    await client.post("/api/profile", json={"name": "Alex", "height_cm": 178.0})

    # Create food and log
    f_res = await client.post(
        "/api/foods",
        json={
            "name": "Apple",
            "nutritional_basis": "100g",
            "calories_kcal": 52.0,
            "protein_g": 0.3,
            "carbs_g": 14.0,
            "fat_g": 0.2,
        },
    )
    food_id = f_res.json()["id"]

    await client.post(
        "/api/meal-logs",
        json={
            "logged_date": "2026-10-23",
            "meal_category": "snacks",
            "food_id": food_id,
            "quantity": 180.0,
            "unit": "g",
        },
    )

    # Export backup
    export_res = await client.get("/api/nutrition/export")
    assert export_res.status_code == 200
    backup_data = export_res.json()
    assert backup_data["version"].startswith("1.")
    assert len(backup_data["foods"]) >= 1
    assert len(backup_data["meal_logs"]) >= 1

    # Test restoring backup
    import_res = await client.post("/api/nutrition/import", json=backup_data)
    assert import_res.status_code == 200
    assert import_res.json()["success"] is True

