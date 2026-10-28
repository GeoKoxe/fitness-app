import sys
sys.path.insert(0, "backend")

import asyncio
import time
from httpx import ASGITransport, AsyncClient
from app.main import app
from tests.conftest import test_engine, TestSessionLocal
from app.models.base import Base
from app.db.seed_generic_foods import seed_generic_foods
from app.db.seed_recipes import seed_built_in_recipes

async def main():
    print("Seeding test DB...")
    t0 = time.time()
    Base.metadata.create_all(bind=test_engine)
    db = TestSessionLocal()
    seed_generic_foods(db)
    seed_built_in_recipes(db)
    db.close()
    print(f"Seeded in {time.time() - t0:.2f}s")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        print("1. Creating profile...")
        res = await client.post("/api/profile", json={"name": "Jordan", "height_cm": 180.0})
        print(f"Profile: {res.status_code}")

        print("2. Setting goals...")
        res = await client.put(
            "/api/nutrition/goals",
            json={"calories_kcal": 2100.0, "protein_g": 140.0, "carbs_g": 220.0, "fat_g": 70.0, "fiber_g": 30.0},
        )
        print(f"Goals: {res.status_code}")

        print("3. Generating meal plan...")
        t1 = time.time()
        res = await client.post(
            "/api/meal-plans/generate",
            json={
                "name": "Jordan's High Protein Week",
                "target_calories": 2100.0,
                "target_protein": 140.0,
                "simplicity_preference": "simple",
                "disliked_foods": ["olives"],
            },
        )
        print(f"Generate response status: {res.status_code} in {time.time() - t1:.2f}s")
        if res.status_code != 201:
            print(res.text)
        else:
            data = res.json()
            print(f"Plan ID: {data['id']}, status: {data['weekly_overview']['plan_status']}, constraints: {data['weekly_overview']['constraint_count']}")

if __name__ == "__main__":
    asyncio.run(main())
