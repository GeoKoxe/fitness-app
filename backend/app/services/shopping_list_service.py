from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.meal_plan import MealPlan, ShoppingListItem
from app.schemas.meal_plan import ShoppingListExportResponse, ShoppingListItemResponse


class ShoppingListService:
    def get_shopping_list(
        self, db: Session, meal_plan_id: int
    ) -> List[ShoppingListItemResponse]:
        items = (
            db.query(ShoppingListItem)
            .filter(ShoppingListItem.meal_plan_id == meal_plan_id)
            .order_by(ShoppingListItem.category.asc(), ShoppingListItem.ingredient_name.asc())
            .all()
        )
        return [
            ShoppingListItemResponse(
                id=it.id,
                meal_plan_id=it.meal_plan_id,
                food_id=it.food_id,
                ingredient_name=it.ingredient_name,
                category=it.category or "Other",
                total_quantity=it.total_quantity,
                unit=it.unit,
                preparation_state=it.preparation_state,
                is_checked=it.is_checked,
                is_excluded=it.is_excluded,
            )
            for it in items
        ]

    def update_item(
        self,
        db: Session,
        item_id: int,
        is_checked: Optional[bool] = None,
        is_excluded: Optional[bool] = None,
    ) -> Optional[ShoppingListItemResponse]:
        item = db.query(ShoppingListItem).filter(ShoppingListItem.id == item_id).first()
        if not item:
            return None
        if is_checked is not None:
            item.is_checked = is_checked
        if is_excluded is not None:
            item.is_excluded = is_excluded
        db.commit()
        db.refresh(item)
        return ShoppingListItemResponse(
            id=item.id,
            meal_plan_id=item.meal_plan_id,
            food_id=item.food_id,
            ingredient_name=item.ingredient_name,
            category=item.category or "Other",
            total_quantity=item.total_quantity,
            unit=item.unit,
            preparation_state=item.preparation_state,
            is_checked=item.is_checked,
            is_excluded=item.is_excluded,
        )

    def export_shopping_list(
        self, db: Session, meal_plan_id: int
    ) -> Optional[ShoppingListExportResponse]:
        plan = db.query(MealPlan).filter(MealPlan.id == meal_plan_id).first()
        if not plan:
            return None

        items = (
            db.query(ShoppingListItem)
            .filter(ShoppingListItem.meal_plan_id == meal_plan_id)
            .order_by(ShoppingListItem.category.asc(), ShoppingListItem.ingredient_name.asc())
            .all()
        )

        responses: List[ShoppingListItemResponse] = []
        categories_map: Dict[str, List[ShoppingListItemResponse]] = {}

        for it in items:
            if it.is_excluded:
                continue
            cat = it.category or "Other"
            r = ShoppingListItemResponse(
                id=it.id,
                meal_plan_id=it.meal_plan_id,
                food_id=it.food_id,
                ingredient_name=it.ingredient_name,
                category=cat,
                total_quantity=it.total_quantity,
                unit=it.unit,
                preparation_state=it.preparation_state,
                is_checked=it.is_checked,
                is_excluded=it.is_excluded,
            )
            responses.append(r)
            if cat not in categories_map:
                categories_map[cat] = []
            categories_map[cat].append(r)

        # Build Plain Text Representation
        text_lines = [
            f"Shopping List: {plan.name}",
            f"Duration: {plan.start_date.strftime('%Y-%m-%d')} to {plan.end_date.strftime('%Y-%m-%d')}",
            "",
            "Note: Prices are not tracked locally. Cost estimates are not fabricated.",
            "",
        ]

        for cat, cat_items in categories_map.items():
            text_lines.append(f"[{cat.upper()}]")
            for it in cat_items:
                check_box = "[x]" if it.is_checked else "[ ]"
                text_lines.append(f"  {check_box} {it.ingredient_name}: {it.total_quantity:g} {it.unit}")
            text_lines.append("")

        plain_text = "\n".join(text_lines)

        return ShoppingListExportResponse(
            meal_plan_id=plan.id,
            meal_plan_name=plan.name,
            total_items_count=len(responses),
            checked_items_count=sum(1 for it in responses if it.is_checked),
            categories=categories_map,
            plain_text=plain_text,
        )


shopping_list_service = ShoppingListService()

