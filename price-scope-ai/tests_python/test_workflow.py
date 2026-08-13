import tempfile
import unittest
from pathlib import Path

from collector_python.agent_guard import create_proposal, redact_fixture
from collector_python.html_adapter import extract_public_price
from collector_python.promotion_engine import optimize_price, validate_promotion_link
from collector_python.session_store import SessionStore


class PromotionWorkflowTests(unittest.TestCase):
    def test_chooses_best_stack_without_double_using_group(self):
        result = optimize_price(300, [
            {"id": "a", "name": "店铺满300减30", "kind": "fixed", "value": 30, "threshold": 300, "stack_group": "merchant"},
            {"id": "b", "name": "平台券20", "kind": "fixed", "value": 20, "stack_group": "platform", "status": "held"},
            {"id": "c", "name": "平台券10", "kind": "fixed", "value": 10, "stack_group": "platform"},
        ], shipping_fee=5)
        self.assertEqual(result["final_price"], 255.0)
        self.assertEqual({p["id"] for p in result["applied_promotions"]}, {"a", "b"})
        self.assertEqual(result["price_basis"], "claimable")

    def test_personalized_price_is_not_market_comparable(self):
        result = optimize_price(100, [{"id": "m", "name": "会员折扣", "kind": "percent", "value": .1, "member_only": True}])
        self.assertFalse(result["comparable_market_price"])

    def test_link_allowlist(self):
        self.assertTrue(validate_promotion_link("https://coupon.jd.com/abc?couponId=1")["valid"])
        self.assertFalse(validate_promotion_link("https://jd.com.evil.example/coupon")["valid"])

    def test_extracts_json_ld_only(self):
        doc = '<script type="application/ld+json">{"offers":{"price":"199.90"}}</script>'
        self.assertEqual(extract_public_price(doc)["price"], 199.9)

    def test_session_store_never_needs_password(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "state.json"; state.write_text("{}", encoding="utf-8")
            record = SessionStore(Path(tmp) / "records").register("京东", str(state))
            self.assertEqual(record["status"], "authorized")
            self.assertNotIn("password", record)

    def test_agent_proposal_is_review_only_and_redacted(self):
        fixture = 'token="secret" <html>new field</html>'
        self.assertIn("[REDACTED]", redact_fixture(fixture))
        proposal = create_proposal("京东", fixture, "price parse failed", ["collector_python/html_adapter.py", "tests_python/test_workflow.py"])
        self.assertEqual(proposal["status"], "pending_human_review")
        with self.assertRaises(ValueError):
            create_proposal("京东", fixture, "bad", ["collector_python/session_store.py"])


if __name__ == "__main__":
    unittest.main()
