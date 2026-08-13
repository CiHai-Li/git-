from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path


class SessionStore:
    """只登记浏览器授权状态文件；不接收、保存平台密码。"""

    def __init__(self, root: str | Path | None = None):
        default = Path(os.getenv("LOCALAPPDATA", Path.home())) / "PriceScopeAI" / "sessions"
        self.root = Path(root) if root else default
        self.root.mkdir(parents=True, exist_ok=True)

    def register(self, platform: str, state_file: str, expires_at: str | None = None) -> dict:
        state = Path(state_file).expanduser().resolve()
        if not state.is_file() or state.suffix.lower() != ".json":
            raise ValueError("授权状态文件必须是已存在的 JSON 文件")
        record = {
            "platform": platform, "state_file": str(state), "expires_at": expires_at,
            "registered_at": datetime.now(timezone.utc).isoformat(), "status": "authorized",
        }
        target = self.root / f"{platform}.session.json"
        target.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        return record

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
