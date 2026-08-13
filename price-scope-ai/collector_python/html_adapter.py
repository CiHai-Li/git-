from __future__ import annotations

import html as html_lib
import json
import re


PRICE_PATTERNS = (
    ("json-ld", re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.I | re.S)),
    ("meta-product", re.compile(r'<meta[^>]+(?:property|name)=["\'](?:product:price:amount|og:price:amount)["\'][^>]+content=["\']([^"\']+)', re.I)),
)


def extract_public_price(document: str) -> dict:
    for method, pattern in PRICE_PATTERNS:
        for match in pattern.finditer(document[:5_000_000]):
            raw = html_lib.unescape(match.group(1).strip())
            if method == "json-ld":
                try:
                    payload = json.loads(raw)
                    items = payload if isinstance(payload, list) else [payload]
                    for item in items:
                        offers = item.get("offers", {}) if isinstance(item, dict) else {}
                        if isinstance(offers, list): offers = offers[0] if offers else {}
                        value = offers.get("price") or offers.get("lowPrice")
                        if value is not None: return {"price": float(value), "method": method}
                except (ValueError, TypeError):
                    continue
            else:
                found = re.search(r"\d+(?:\.\d+)?", raw)
                if found: return {"price": float(found.group()), "method": method}
    raise ValueError("未从公开结构化字段识别价格；不要猜测页面展示值")
