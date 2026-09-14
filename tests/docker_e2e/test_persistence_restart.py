#!/usr/bin/env python3
"""
Persistence Mount & Container Restart E2E Test
Validates:
Stage 1:
- Authenticates via REST API
- Creates persistent share record via POST /api/share/create
- Asserts state is flushed to mounted volume file data/state.json
- Saves token to /tmp/ci_persist_token.txt

Stage 2 (After docker compose restart):
- Re-authenticates via REST API
- Reads /tmp/ci_persist_token.txt
- Queries GET /api/share/list and GET /api/share/info
- Asserts persistent state survived container restart with 100% integrity
"""

import json
import os
import ssl
import sys
import urllib.request


def http_request(url: str, method: str = "GET", data: dict = None, token: str = None) -> dict:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    payload = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


def stage1(host: str, port: int, data_dir: str):
    print(f"[*] Stage 1: Creating persistent record on https://{host}:{port}...")
    login_resp = http_request(f"https://{host}:{port}/api/login", method="POST", data={"username": "admin", "password": "admin123"})
    jwt = login_resp.get("token")
    assert jwt, f"Login failed: {login_resp}"

    create_payload = {
        "device_id": "ci-persistent-device-999",
        "view_only": False,
        "card_code": "CI-PERSIST-9999",
    }
    share_resp = http_request(f"https://{host}:{port}/api/share/create", method="POST", data=create_payload, token=jwt)
    share_token = share_resp.get("data", {}).get("token")
    assert share_token, f"Share creation failed: {share_resp}"
    print(f"[+] Created share link with token: {share_token}")

    # Check host file data/state.json
    state_file = os.path.join(data_dir, "state.json")
    assert os.path.exists(state_file), f"Expected state file {state_file} does not exist!"
    with open(state_file, "r", encoding="utf-8") as f:
        state_content = f.read()
    assert share_token in state_content, f"Share token {share_token} not found in mounted {state_file}!"
    print(f"[+] Verified share token flushed to host mounted volume: {state_file}")

    token_cache = os.path.join("/tmp", "ci_persist_token.txt")
    with open(token_cache, "w", encoding="utf-8") as f:
        f.write(share_token)
    print(f"[+] Cached share token to {token_cache} for Stage 2")


def stage2(host: str, port: int):
    print(f"[*] Stage 2: Validating persistence AFTER container restart on https://{host}:{port}...")
    token_cache = os.path.join("/tmp", "ci_persist_token.txt")
    assert os.path.exists(token_cache), f"Missing token cache {token_cache}"
    with open(token_cache, "r", encoding="utf-8") as f:
        share_token = f.read().strip()

    login_resp = http_request(f"https://{host}:{port}/api/login", method="POST", data={"username": "admin", "password": "admin123"})
    jwt = login_resp.get("token")
    assert jwt, f"Re-login failed after container restart: {login_resp}"

    # Verify via /api/share/list
    list_resp = http_request(f"https://{host}:{port}/api/share/list", method="GET", token=jwt)
    shares = list_resp.get("data", [])
    found = any(s.get("token") == share_token for s in shares)
    assert found, f"Share token {share_token} not found in /api/share/list after restart! Returned: {list_resp}"
    print(f"[+] Share token {share_token} found in /api/share/list after container restart")

    # Verify via /api/share/info
    info_resp = http_request(f"https://{host}:{port}/api/share/info?token={share_token}", method="GET")
    info_data = info_resp.get("data", {})
    assert info_data.get("device_id") == "ci-persistent-device-999", (
        f"Device ID mismatch in restored share info: {info_resp}"
    )
    print(f"[+] Share record attributes strictly verified (device_id=ci-persistent-device-999)")
    print("[SUCCESS] Persistence mount & container restart test PASSED 100%!")


def main():
    stage = sys.argv[1] if len(sys.argv) > 1 else "stage1"
    host = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
    port = int(sys.argv[3]) if len(sys.argv) > 3 else 8443
    data_dir = sys.argv[4] if len(sys.argv) > 4 else "data"

    if stage == "stage1":
        stage1(host, port, data_dir)
    elif stage == "stage2":
        stage2(host, port)
    else:
        raise ValueError(f"Unknown stage: {stage}")


if __name__ == "__main__":
    main()
