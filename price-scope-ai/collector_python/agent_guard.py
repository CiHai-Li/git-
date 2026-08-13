from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path


ALLOWED_PATCH_PREFIXES = ("collector_python/html_adapter.py", "tests_python/")
FORBIDDEN_MARKERS = ("cookie", "authorization", "password", "captcha", "subprocess", "os.system")


@dataclass
class RepairProposal:
    platform: str
    fixture_sha256: str
    symptom: str
    proposed_files: list[str]
    status: str = "pending_human_review"


def redact_fixture(document: str) -> str:
    import re
    cleaned = re.sub(
        r'(?i)(cookie|authorization|token|password)\s*[=:]\s*["\'][^"\']+["\']',
        r"\1=[REDACTED]",
        document,
    )
    cleaned = re.sub(r"(?i)set-cookie:[^\r\n]+", "Set-Cookie: [REDACTED]", cleaned)
    return cleaned[:300_000]


def create_proposal(platform: str, fixture: str, symptom: str, proposed_files: list[str]) -> dict:
    if not proposed_files or any(not path.replace("\\", "/").startswith(ALLOWED_PATCH_PREFIXES) for path in proposed_files):
        raise ValueError("Agent 只能建议修改解析器和对应测试")
    lower = fixture.lower()
    if any(marker in lower for marker in FORBIDDEN_MARKERS):
        fixture = redact_fixture(fixture)
    proposal = RepairProposal(platform, hashlib.sha256(fixture.encode("utf-8")).hexdigest(), symptom, proposed_files)
    return asdict(proposal)


def save_proposal(target: str | Path, proposal: dict) -> None:
    Path(target).write_text(json.dumps(proposal, ensure_ascii=False, indent=2), encoding="utf-8")
