#!/usr/bin/env python3
"""
Live Container WSS / WebSocket End-to-End Test
Validates live containerized signaling server over HTTPS/WSS:
1. Unauthenticated /connect_client: Assert 101 upgrade + immediate fail-closed error frame
2. Agent registration (/register_agent): Assert 101 upgrade + persistent connection with AGENT_SECRET
3. Authenticated client session (/connect_client?token=...): Assert 101 upgrade with JWT token
4. Device selection & Capability synchronization: Client connect -> Agent receives update_caps
5. Full WebRTC Signaling Exchange: Client offer -> Server forward -> Agent receive -> Agent answer -> Client receive
"""

import json
import ssl
import sys
import urllib.request

from simple_ws import SimpleWebSocket


def http_login(host: str, port: int, user: str = "admin", password: str = "admin123") -> str:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    url = f"https://{host}:{port}/api/login"
    payload = json.dumps({"username": user, "password": password}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        token = data.get("token")
        if not token:
            raise ValueError(f"No token returned from login: {data}")
        return token


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8443
    agent_secret = (
        sys.argv[3] if len(sys.argv) > 3 else "ci_production_random_secret_48921849128491028491"
    )
    device_id = "ci-docker-agent-01"

    print(f"[*] Starting WSS Container E2E Test on wss://{host}:{port}...")

    # 1. Negative Test: Unauthenticated /connect_client must fail-closed
    print("[-] 1. Testing Unauthenticated /connect_client (Fail-Closed)...")
    ws_unauth = SimpleWebSocket(host, port, "/connect_client", use_ssl=True)
    try:
        err_frame = ws_unauth.recv_text(timeout=5.0)
        err_data = json.loads(err_frame)
        msg_type = err_data.get("type") or err_data.get("message_type")
        assert msg_type == "error", f"Expected error frame, got: {err_data}"
        print(f"[+] STEP 1 PASS: Unauthenticated client rejected fail-closed with: {err_data.get('error')}")
    except (ConnectionResetError, EOFError):
        print("[+] STEP 1 PASS: Unauthenticated client socket immediately terminated fail-closed")
    finally:
        ws_unauth.close()

    # 2. Agent Registration over WSS
    print("[-] 2. Registering Agent over WSS (/register_agent)...")
    agent_path = f"/register_agent?id={device_id}&token={agent_secret}"
    ws_agent = SimpleWebSocket(host, port, agent_path, use_ssl=True)
    print("[+] STEP 2 PASS: Agent registered over WSS with 101 Switching Protocols")

    # 3. Client Authentication via REST and WSS connection with JWT
    print("[-] 3. Authenticating admin and opening WSS /connect_client with JWT...")
    jwt_token = http_login(host, port, "admin", "admin123")
    client_path = f"/connect_client?token={jwt_token}"
    ws_client = SimpleWebSocket(host, port, client_path, use_ssl=True)
    print("[+] STEP 3 PASS: Authenticated client connected over WSS with 101 Switching Protocols")

    try:
        # 4. Client Connects to Device -> Verifies Capability Sync
        print(f"[-] 4. Client connecting to device '{device_id}'...")
        ws_client.send_text(json.dumps({
            "type": "connect",
            "device_id": device_id,
        }))

        # Agent receives capability update
        caps_msg = ws_agent.recv_text(timeout=5.0)
        caps_data = json.loads(caps_msg)
        action = caps_data.get("action") or caps_data.get("type")
        assert action == "update_caps", f"Expected update_caps on agent, got: {caps_data}"
        client_id = caps_data.get("client_id")
        assert client_id, "Missing client_id in update_caps payload"
        print(f"[+] STEP 4 PASS: Agent received real-time capability sync for client '{client_id}'")

        # 5. Full WebRTC Signaling Exchange (Offer -> Forward -> Answer)
        print("[-] 5. Transmitting WebRTC SDP Offer / Answer via WebSocket...")
        test_sdp_offer = "v=0\r\no=- 112233 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
        ws_client.send_text(json.dumps({
            "type": "forward",
            "device_id": device_id,
            "payload": {
                "type": "offer",
                "sdp": test_sdp_offer,
            },
        }))

        agent_offer_msg = ws_agent.recv_text(timeout=5.0)
        offer_data = json.loads(agent_offer_msg)
        msg_type = offer_data.get("message_type") or offer_data.get("action") or offer_data.get("type")
        assert msg_type in ("forward", "client_msg"), (
            f"Expected forward or client_msg on agent, got: {offer_data}"
        )
        assert offer_data.get("payload", {}).get("type") == "offer", (
            f"Expected offer payload, got: {offer_data}"
        )
        print("[+] STEP 5a PASS: WebRTC SDP Offer successfully routed Client -> Signaling -> Agent")

        test_sdp_answer = "v=0\r\no=- 445566 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
        ws_agent.send_text(json.dumps({
            "type": "forward",
            "client_id": client_id,
            "payload": {
                "type": "answer",
                "sdp": test_sdp_answer,
            },
        }))

        client_ans_msg = ws_client.recv_text(timeout=5.0)
        ans_data = json.loads(client_ans_msg)
        ans_msg_type = ans_data.get("message_type") or ans_data.get("type")
        assert ans_msg_type == "device_msg", f"Expected device_msg on client, got: {ans_data}"
        assert ans_data.get("payload", {}).get("type") == "answer", (
            f"Expected answer payload on client, got: {ans_data}"
        )
        print("[+] STEP 5b PASS: WebRTC SDP Answer successfully routed Agent -> Signaling -> Client")
        print("[SUCCESS] Live Container WSS / WebSocket End-to-End Test PASSED 100%!")

    finally:
        ws_client.close()
        ws_agent.close()


if __name__ == "__main__":
    main()
