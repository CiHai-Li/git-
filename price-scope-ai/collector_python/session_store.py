from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path


class SessionStore:
    """登记可复用的浏览器授权状态与非敏感账号画像；不接收平台密码。"""

    def __init__(self, root: str | Path | None = None):
        default = Path(os.getenv("LOCALAPPDATA", Path.home())) / "PriceScopeAI" / "sessions"
        self.root = Path(root) if root else default
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _safe_id(value: str) -> str:
        cleaned = "".join(char for char in value if char.isalnum() or char in "-_")
        if not cleaned:
            raise ValueError("账号标识不能为空")
        return cleaned[:64]

    def register(
        self,
        platform: str,
        state_file: str,
        expires_at: str | None = None,
        account_id: str = "default",
        profile: dict | None = None,
        make_active: bool = True,
    ) -> dict:
        if not platform.strip():
            raise ValueError("平台不能为空")
        state = Path(state_file).expanduser().resolve()
        if not state.is_file() or state.suffix.lower() != ".json":
            raise ValueError("授权状态文件必须是已存在的 JSON 文件")
        safe_account_id = self._safe_id(account_id)
        safe_profile = {
            key: str(value)[:120]
            for key, value in (profile or {}).items()
            if key in {"alias", "member_level", "region", "coupon_scope", "note"}
        }
        record = {
            "platform": platform.strip(), "account_id": safe_account_id,
            "state_file": str(state), "expires_at": expires_at, "profile": safe_profile,
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "status": "authorized", "active": bool(make_active),
        }
        if make_active:
            for path in self.root.glob(f"{platform.strip()}--*.session.json"):
                try:
                    other = json.loads(path.read_text(encoding="utf-8"))
                    other["active"] = False
                    path.write_text(json.dumps(other, ensure_ascii=False, indent=2), encoding="utf-8")
                except (OSError, ValueError):
                    continue
        target = self.root / f"{platform.strip()}--{safe_account_id}.session.json"
        target.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        return record

    def activate(self, platform: str, account_id: str) -> dict:
        safe_account_id = self._safe_id(account_id)
        target = self.root / f"{platform}--{safe_account_id}.session.json"
        if not target.is_file():
            raise ValueError("未找到指定账号授权")
        selected = None
        for path in self.root.glob(f"{platform}--*.session.json"):
            record = json.loads(path.read_text(encoding="utf-8"))
            record["active"] = path == target
            path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
            if path == target:
                selected = record
        return selected

    def list(self) -> list[dict]:
        records = []
        for path in sorted(self.root.glob("*.session.json")):
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
                record["state_available"] = Path(record["state_file"]).is_file()
                records.append(record)
            except (OSError, ValueError, KeyError):
                continue
        return records
