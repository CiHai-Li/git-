from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP


def _money(value) -> float:
    number = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if number < 0:
        raise ValueError("价格字段不能为负数")
    return float(number)


def normalize_checkout_preview(payload: dict, session: dict) -> dict:
    """把已授权浏览器连接器返回的结算页结果规范化，并强制绑定账号条件。"""
    if session.get("status") != "authorized" or not session.get("state_available", True):
        raise ValueError("账号授权状态不可用")
    required = ("platform", "sku", "quantity", "item_amount", "payable_amount")
    missing = [key for key in required if payload.get(key) in (None, "")]
    if missing:
        raise ValueError(f"结算预览缺少字段：{', '.join(missing)}")
    quantity = int(payload["quantity"])
    if quantity < 1:
        raise ValueError("商品数量必须大于 0")
    if payload["platform"] != session.get("platform"):
        raise ValueError("结算结果平台与授权账号不一致")
    item_amount = _money(payload["item_amount"])
    shipping_fee = _money(payload.get("shipping_fee", 0))
    payable_amount = _money(payload["payable_amount"])
    if payable_amount > item_amount + shipping_fee:
        raise ValueError("应付金额高于商品金额与运费之和，需要人工复核")
    profile = session.get("profile") or {}
    return {
        "platform": payload["platform"], "sku": str(payload["sku"]), "quantity": quantity,
        "item_amount": item_amount, "discount": _money(item_amount + shipping_fee - payable_amount),
        "shipping_fee": shipping_fee, "checkout_preview_price": payable_amount,
        "promotions": list(payload.get("promotions") or []), "price_basis": "checkout_preview",
        "account": {
            "account_id": session.get("account_id"), "alias": profile.get("alias", "未命名账号"),
            "member_level": profile.get("member_level", "未记录"), "region": profile.get("region", "未记录"),
            "coupon_scope": profile.get("coupon_scope", "未记录"),
        },
        "captured_at": payload.get("captured_at") or datetime.now(timezone.utc).isoformat(),
        "verification": "checkout_page_before_submit", "order_submitted": False,
    }
