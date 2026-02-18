#!/usr/bin/env python3
"""BOOKFORGE production preflight checks.

Usage:
  python scripts/ops/preflight_check.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Callable

def load_dotenv_fallback(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    load_dotenv_fallback()


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def http_request(url: str, headers: dict[str, str] | None = None) -> tuple[int, str]:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read(500).decode("utf-8", errors="ignore")
            return resp.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read(500).decode("utf-8", errors="ignore")
        return exc.code, body
    except Exception as exc:
        return 0, str(exc)


def env_required(name: str) -> CheckResult:
    value = os.getenv(name)
    return CheckResult(name=f"env:{name}", ok=bool(value), detail="set" if value else "missing")


def env_any(name: str, aliases: list[str]) -> CheckResult:
    keys = [name, *aliases]
    for key in keys:
        if os.getenv(key):
            if key == name:
                return CheckResult(name=f"env:{name}", ok=True, detail="set")
            return CheckResult(name=f"env:{name}", ok=True, detail=f"set via {key}")
    return CheckResult(name=f"env:{name}", ok=False, detail="missing")


def check_supabase() -> CheckResult:
    base = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not base or not key:
        return CheckResult("supabase", False, "SUPABASE_URL/SERVICE_ROLE missing")

    status, body = http_request(
        f"{base}/rest/v1/profiles?select=id&limit=1",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    if status >= 400 or status == 0:
        return CheckResult("supabase", False, f"HTTP {status}: {body[:120]}")
    return CheckResult("supabase", True, "REST reachable")


def check_stripe() -> CheckResult:
    secret = os.getenv("STRIPE_SECRET_KEY")
    if not secret:
        return CheckResult("stripe", False, "STRIPE_SECRET_KEY missing")

    status, body = http_request(
        "https://api.stripe.com/v1/account",
        headers={"Authorization": f"Bearer {secret}"},
    )
    if status >= 400 or status == 0:
        return CheckResult("stripe", False, f"HTTP {status}: {body[:120]}")
    return CheckResult("stripe", True, "Account API reachable")


def check_resend() -> CheckResult:
    key = os.getenv("RESEND_API_KEY")
    if not key:
        return CheckResult("resend", False, "RESEND_API_KEY missing")

    status, body = http_request(
        "https://api.resend.com/domains",
        headers={"Authorization": f"Bearer {key}"},
    )
    if status >= 400 or status == 0:
        return CheckResult("resend", False, f"HTTP {status}: {body[:120]}")
    return CheckResult("resend", True, "Domains API reachable")


def check_gemini() -> CheckResult:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return CheckResult("gemini", False, "GEMINI_API_KEY missing")

    status, body = http_request(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
    if status >= 400 or status == 0:
        return CheckResult("gemini", False, f"HTTP {status}: {body[:120]}")
    return CheckResult("gemini", True, "Models API reachable")


def check_elevenlabs() -> CheckResult:
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        return CheckResult("elevenlabs", False, "ELEVENLABS_API_KEY missing")

    status, body = http_request(
        "https://api.elevenlabs.io/v1/voices",
        headers={"xi-api-key": key},
    )
    if status >= 400 or status == 0:
        return CheckResult("elevenlabs", False, f"HTTP {status}: {body[:120]}")
    return CheckResult("elevenlabs", True, "Voices API reachable")


def main() -> int:
    required = [
        "NEXT_PUBLIC_API_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_STARTER",
        "STRIPE_PRICE_PRO",
        "STRIPE_PRICE_ENTERPRISE",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
        "GEMINI_API_KEY",
        "ELEVENLABS_API_KEY",
        "CRON_SECRET",
    ]

    checks: list[CheckResult] = []
    checks.append(env_any("NEXT_PUBLIC_API_URL", ["API_URL"]))
    checks.append(env_any("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]))
    checks.append(env_any("NEXT_PUBLIC_SUPABASE_ANON_KEY", ["SUPABASE_ANON_KEY"]))
    checks.extend(env_required(name) for name in required[3:])

    online_checks: list[Callable[[], CheckResult]] = [
        check_supabase,
        check_stripe,
        check_resend,
        check_gemini,
        check_elevenlabs,
    ]

    for check_fn in online_checks:
        try:
            checks.append(check_fn())
        except Exception as exc:
            checks.append(CheckResult(check_fn.__name__, False, f"Exception: {exc}"))

    failures = [c for c in checks if not c.ok]

    for c in checks:
        marker = "PASS" if c.ok else "FAIL"
        print(f"[{marker}] {c.name}: {c.detail}")

    if failures:
        print(f"\nPreflight failed: {len(failures)} issue(s).")
        return 1

    print("\nPreflight passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
