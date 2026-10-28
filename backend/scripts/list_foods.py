import sys
sys.path.insert(0, "backend")
from app.data.generic_foods import GENERIC_FOODS

def main():
    print(f"Total generic foods: {len(GENERIC_FOODS)}")
    for f in sorted(GENERIC_FOODS, key=lambda x: (x.get("category", ""), x["name"])):
        print(f"[{f.get('category')}] {f['name']} (ext: {f['external_id']}): {f['calories_kcal']} kcal, P:{f['protein_g']}g, C:{f['carbs_g']}g, F:{f['fat_g']}g per {f.get('serving_quantity', 100)}{f.get('serving_unit', 'g')}")

if __name__ == "__main__":
    main()

