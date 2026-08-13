from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .promotion_engine import optimize_price, validate_promotion_link
from .session_store import SessionStore


class Handler(BaseHTTPRequestHandler):
    def _allowed_origin(self) -> str:
        origin = self.headers.get("origin", "")
        return origin if origin in {"http://127.0.0.1:4173", "http://localhost:4173", "http://127.0.0.1:5173", "http://localhost:5173"} else "http://127.0.0.1:4173"

    def _reply(self, status: int, payload: dict | list):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("access-control-allow-origin", self._allowed_origin())
        self.send_header("content-length", str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("access-control-allow-origin", self._allowed_origin())
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("access-control-allow-headers", "content-type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health": return self._reply(200, {"status": "ok", "service": "price-scope-python"})
        if self.path == "/api/sessions": return self._reply(200, {"sessions": SessionStore().list()})
        return self._reply(404, {"error": "not found"})

    def do_POST(self):
        try:
            length = min(int(self.headers.get("content-length", "0")), 1_000_000)
            payload = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/api/promotions/inspect":
                result = validate_promotion_link(str(payload.get("url", "")))
                return self._reply(200 if result["valid"] else 400, result)
            if self.path == "/api/promotions/optimize":
                return self._reply(200, optimize_price(payload.get("sale_price", 0), payload.get("promotions", []), payload.get("shipping_fee", 0), payload.get("quantity", 1), payload.get("include_claimable", True)))
            if self.path == "/api/sessions/register":
                record = SessionStore().register(str(payload.get("platform", "")), str(payload.get("state_file", "")), payload.get("expires_at"))
                return self._reply(201, record)
            return self._reply(404, {"error": "not found"})
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            return self._reply(400, {"error": str(error)})

    def log_message(self, *_):
        return


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 8790), Handler)
    print("价策 AI Python 服务：http://127.0.0.1:8790")
    server.serve_forever()


if __name__ == "__main__":
    main()
