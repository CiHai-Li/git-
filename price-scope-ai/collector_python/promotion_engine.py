from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal, ROUND_HALF_UP
from itertools import combinations
from urllib.parse import parse_qs, urlparse


PLATFORM_HOSTS = {
    "京东": ("jd.com", "3.cn"),
    "淘宝/天猫": ("taobao.com", "tmall.com", "tb.cn"),
    "拼多多": ("pinduoduo.com", "yangkeduo.com"),
    "苏宁易购": ("suning.com",),
    "唯品会": ("vip.com",),
}


def money(value: Decimal | float | int | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Promotion:
    id: str
    name: str
    kind: str
    value: Decimal
    threshold: Decimal = Decimal("0")
    stack_group: str = "coupon"
    status: str = "claimable"
    scope: str = "sku"
    member_only: bool = False
    account_specific: bool = False

    @classmethod
    def from_dict(cls, raw: dict) -> "Promotion":
        return cls(
            id=str(raw.get("id", "PROMO")), name=str(raw.get("name", "未命名优惠")),
            kind=str(raw.get("kind", "fixed")), value=money(raw.get("value", 0)),
            threshold=money(raw.get("threshold", 0)), stack_group=str(raw.get("stack_group", "coupon")),
            status=str(raw.get("status", "claimable")), scope=str(raw.get("scope", "sku")),
            member_only=bool(raw.get("member_only", False)),
            account_specific=bool(raw.get("account_specific", False)),
        )


def validate_promotion_link(url: str) -> dict:
    parsed = urlparse(url.strip())
    if parsed.scheme != "https" or not parsed.hostname:
        return {"valid": False, "reason": "仅接受带有有效域名的 HTTPS 链接"}
    host = parsed.hostname.lower().rstrip(".")
    platform = next((name for name, domains in PLATFORM_HOSTS.items() if any(host == d or host.endswith(f".{d}") for d in domains)), None)
    if not platform:
        return {"valid": False, "reason": "链接不属于当前允许的平台域名"}
    query = parse_qs(parsed.query)
    return {
        "valid": True, "platform": platform, "host": host,
        "campaign_id": next((query[key][0] for key in ("activityId", "couponId", "id") if query.get(key)), None),
        "requires_redirect_check": host in {"3.cn", "tb.cn"},
    }


def _discount(promotion: Promotion, subtotal: Decimal) -> Decimal:
    if subtotal < promotion.threshold:
        return Decimal("0")
    if promotion.kind == "fixed":
        return min(promotion.value, subtotal)
    if promotion.kind == "percent":
        return min(subtotal * promotion.value, subtotal)
    return Decimal("0")


def optimize_price(sale_price: float | int | str, promotions: list[dict], shipping_fee=0, quantity=1, include_claimable=True) -> dict:
    subtotal = money(sale_price) * max(int(quantity), 1)
    candidates = [Promotion.from_dict(item) for item in promotions]
    allowed_status = {"held", "auto"} | ({"claimable"} if include_claimable else set())
    candidates = [item for item in candidates if item.status in allowed_status]
    best_total = subtotal + money(shipping_fee)
    best_items: tuple[Promotion, ...] = ()
    best_discount = Decimal("0")

    for size in range(len(candidates) + 1):
        for bundle in combinations(candidates, size):
            groups = [item.stack_group for item in bundle if item.stack_group]
            if len(groups) != len(set(groups)):
                continue
            total_discount = sum((_discount(item, subtotal) for item in bundle), Decimal("0"))
            total = max(Decimal("0"), subtotal - total_discount) + money(shipping_fee)
            if total < best_total:
                best_total, best_items, best_discount = total, bundle, total_discount

    contains_account_price = any(item.account_specific or item.member_only for item in best_items)
    all_held = all(item.status in {"held", "auto"} for item in best_items)
    basis = "held" if best_items and all_held else "claimable" if best_items else "public"
    return {
        "sale_price": float(money(sale_price)), "quantity": max(int(quantity), 1),
        "subtotal": float(money(subtotal)), "discount": float(money(best_discount)),
        "shipping_fee": float(money(shipping_fee)), "final_price": float(money(best_total)),
        "price_basis": basis, "comparable_market_price": not contains_account_price,
        "applied_promotions": [{**asdict(item), "value": float(item.value), "threshold": float(item.threshold)} for item in best_items],
        "conditions": [item.name for item in best_items],
    }
