import logging
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.schemas.food import FoodCreate

logger = logging.getLogger(__name__)

# Bounded in-memory search cache (max 100 entries, 1-hour TTL)
CACHE_MAX_SIZE = 100
CACHE_TTL_SECONDS = 3600

_cache_lock = threading.Lock()
_search_cache: Dict[str, Tuple[float, List[FoodCreate]]] = {}


def _get_from_cache(key: str) -> Optional[List[FoodCreate]]:
    with _cache_lock:
        if key in _search_cache:
            ts, items = _search_cache[key]
            if time.time() - ts < CACHE_TTL_SECONDS:
                return items
            else:
                del _search_cache[key]
    return None


def _set_cache(key: str, items: List[FoodCreate]) -> None:
    with _cache_lock:
        if len(_search_cache) >= CACHE_MAX_SIZE:
            # Evict oldest entry
            oldest_key = min(_search_cache, key=lambda k: _search_cache[k][0])
            _search_cache.pop(oldest_key, None)
        _search_cache[key] = (time.time(), items)


class OpenFoodFactsService:
    BASE_URL = "https://world.openfoodfacts.org"
    USER_AGENT = "FitPulseNutritionApp/1.0 (contact: local-personal-use)"

    def _parse_product(self, prod: Dict[str, Any]) -> Optional[FoodCreate]:
        name = prod.get("product_name") or prod.get("product_name_en")
        if not name or not str(name).strip():
            return None

        name = str(name).strip()
        brand = prod.get("brands")
        if brand:
            brand = str(brand).strip().split(",")[0].strip() or None

        category = prod.get("categories")
        if category:
            category = str(category).strip().split(",")[0].strip() or None

        barcode = prod.get("code")
        external_id = f"off_{barcode}" if barcode else None

        nutriments = prod.get("nutriments") or {}

        # Energy: prefer energy-kcal_100g, fallback to energy_100g in kcal
        calories = nutriments.get("energy-kcal_100g")
        if calories is None:
            energy_kj = nutriments.get("energy_100g")
            if energy_kj is not None and isinstance(energy_kj, (int, float)):
                calories = round(float(energy_kj) / 4.184, 1)

        protein = nutriments.get("proteins_100g")
        carbs = nutriments.get("carbohydrates_100g")
        fat = nutriments.get("fat_100g")

        # If base macronutrients are missing, skip or default sensibly
        if calories is None or protein is None or carbs is None or fat is None:
            return None

        # Optional micronutrients
        fiber = nutriments.get("fiber_100g")
        sugar = nutriments.get("sugars_100g")
        sat_fat = nutriments.get("saturated-fat_100g")
        sodium_g = nutriments.get("sodium_100g")
        sodium_mg = round(float(sodium_g) * 1000.0, 1) if sodium_g is not None else None

        # Serving information
        serving_desc = prod.get("serving_size")
        serving_qty = prod.get("serving_quantity")
        serving_unit = "g"
        if serving_qty is not None:
            try:
                serving_qty = float(serving_qty)
            except (ValueError, TypeError):
                serving_qty = None

        nutritional_basis = "100ml" if prod.get("nutrition_data_per") == "100ml" else "100g"

        try:
            return FoodCreate(
                name=name[:200],
                brand=brand[:200] if brand else None,
                category=category[:100] if category else None,
                source="open_food_facts",
                external_id=external_id,
                barcode=str(barcode)[:100] if barcode else None,
                nutritional_basis=nutritional_basis,
                serving_description=str(serving_desc)[:100] if serving_desc else None,
                serving_quantity=serving_qty,
                serving_unit=serving_unit,
                calories_kcal=max(round(float(calories), 1), 0.0),
                protein_g=max(round(float(protein), 1), 0.0),
                carbs_g=max(round(float(carbs), 1), 0.0),
                fat_g=max(round(float(fat), 1), 0.0),
                fiber_g=max(round(float(fiber), 1), 0.0) if fiber is not None else None,
                sugar_g=max(round(float(sugar), 1), 0.0) if sugar is not None else None,
                saturated_fat_g=max(round(float(sat_fat), 1), 0.0) if sat_fat is not None else None,
                sodium_mg=max(round(float(sodium_mg), 1), 0.0) if sodium_mg is not None else None,
                is_favorite=False,
            )
        except Exception as e:
            logger.debug(f"Failed to parse product {name}: {e}")
            return None

    def search_foods(self, query: str, limit: int = 15) -> List[FoodCreate]:
        q = query.strip()
        if len(q) < 2:
            return []

        cache_key = f"search_{q.lower()}_{limit}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            return cached

        # Open Food Facts API v2 search endpoint
        url = f"{self.BASE_URL}/cgi/search.pl"
        params = {
            "search_terms": q,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page_size": str(limit),
            "fields": "code,product_name,product_name_en,brands,categories,serving_size,serving_quantity,nutriments,nutrition_data_per",
        }
        headers = {"User-Agent": self.USER_AGENT}

        results: List[FoodCreate] = []
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(url, params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    products = data.get("products", [])
                    for p in products:
                        item = self._parse_product(p)
                        if item:
                            results.append(item)
        except Exception as e:
            logger.warning(f"Open Food Facts search request failed for query '{q}': {e}")
            return []

        _set_cache(cache_key, results)
        return results

    def get_by_barcode(self, barcode: str) -> Optional[FoodCreate]:
        bc = barcode.strip()
        if not bc:
            return None

        cache_key = f"barcode_{bc}"
        cached = _get_from_cache(cache_key)
        if cached is not None:
            return cached[0] if cached else None

        url = f"{self.BASE_URL}/api/v2/product/{bc}.json"
        headers = {"User-Agent": self.USER_AGENT}

        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == 1 and "product" in data:
                        parsed = self._parse_product(data["product"])
                        if parsed:
                            _set_cache(cache_key, [parsed])
                            return parsed
        except Exception as e:
            logger.warning(f"Open Food Facts barcode lookup failed for '{bc}': {e}")

        return None


open_food_facts_service = OpenFoodFactsService()
