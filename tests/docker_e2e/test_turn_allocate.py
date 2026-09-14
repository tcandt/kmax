#!/usr/bin/env python3
"""
RFC 5766 TURN Allocation & STUN Binding Probe
Validates live Coturn container on port 3478:
1. STUN Binding Request (0x0001) -> Binding Success (0x0101)
2. Initial TURN Allocate Request (0x0003) -> 401 Unauthorized with REALM & NONCE
3. Authenticated Allocate Request (0x0003) -> Allocate Success (0x0103)
4. Decodes XOR-RELAYED-ADDRESS (0x0016) and asserts port in [49152, 49252] range
5. Clean Deallocation via Refresh Request with LIFETIME=0
"""

import binascii
import hashlib
import hmac
import os
import socket
import struct
import sys

STUN_MAGIC = 0x2112A442

# STUN/TURN Message Types
BINDING_REQUEST = 0x0001
BINDING_SUCCESS = 0x0101
ALLOCATE_REQUEST = 0x0003
ALLOCATE_SUCCESS = 0x0103
ALLOCATE_ERROR = 0x0113
REFRESH_REQUEST = 0x0004
REFRESH_SUCCESS = 0x0104

# Attributes
ATTR_MAPPED_ADDRESS = 0x0001
ATTR_USERNAME = 0x0006
ATTR_MESSAGE_INTEGRITY = 0x0008
ATTR_ERROR_CODE = 0x0009
ATTR_LIFETIME = 0x000D
ATTR_REALM = 0x0014
ATTR_NONCE = 0x0015
ATTR_XOR_RELAYED_ADDRESS = 0x0016
ATTR_REQUESTED_TRANSPORT = 0x0019
ATTR_XOR_MAPPED_ADDRESS = 0x0020
ATTR_FINGERPRINT = 0x8028


def pad4(data: bytes) -> bytes:
    pad_len = (4 - (len(data) % 4)) % 4
    return data + b"\x00" * pad_len


def build_attr(attr_type: int, val: bytes) -> bytes:
    padded = pad4(val)
    return struct.pack("!HH", attr_type, len(val)) + padded


def parse_attrs(data: bytes):
    attrs = {}
    idx = 0
    while idx + 4 <= len(data):
        attr_type, attr_len = struct.unpack("!HH", data[idx : idx + 4])
        val_start = idx + 4
        val_end = val_start + attr_len
        if val_end > len(data):
            break
        val = data[val_start:val_end]
        attrs[attr_type] = val
        # Move forward including 4-byte padding
        padded_len = (attr_len + 3) & ~3
        idx = val_start + padded_len
    return attrs


def decode_xor_address(val: bytes, magic: int, tx_id: bytes):
    if len(val) < 8:
        raise ValueError("XOR address too short")
    _, family, x_port = struct.unpack("!BBH", val[:4])
    port = x_port ^ (magic >> 16)
    if family == 0x01:  # IPv4
        x_ip = struct.unpack("!I", val[4:8])[0]
        ip_int = x_ip ^ magic
        ip = socket.inet_ntoa(struct.pack("!I", ip_int))
        return ip, port
    elif family == 0x02:  # IPv6
        full_cookie = struct.pack("!I", magic) + tx_id
        ip_bytes = bytes([b ^ c for b, c in zip(val[4:20], full_cookie)])
        ip = socket.inet_ntop(socket.AF_INET6, ip_bytes)
        return ip, port
    raise ValueError(f"Unknown family: {family}")


def compute_stun_key(username: str, realm: str, password: str) -> bytes:
    s = f"{username}:{realm}:{password}".encode("utf-8")
    return hashlib.md5(s).digest()


def send_recv_turn(sock, host, port, msg: bytes) -> tuple:
    sock.sendto(msg, (host, port))
    data, _ = sock.recvfrom(2048)
    if len(data) < 20:
        raise ValueError(f"Response too short: {len(data)} bytes")
    m_type, m_len, magic = struct.unpack("!HHI", data[:8])
    tx_id = data[8:20]
    body = data[20 : 20 + m_len]
    attrs = parse_attrs(body)
    return m_type, magic, tx_id, attrs


def main():
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 3478
    user = sys.argv[3] if len(sys.argv) > 3 else "cloudphone_user"
    password = sys.argv[4] if len(sys.argv) > 4 else "cloudphone_secure_password"

    print(f"[*] Probing Coturn on {host}:{port} with user '{user}'...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(5.0)

    # 1. STUN Binding Test
    tx_id = os.urandom(12)
    hdr = struct.pack("!HHI", BINDING_REQUEST, 0, STUN_MAGIC) + tx_id
    m_type, magic, resp_tx, attrs = send_recv_turn(sock, host, port, hdr)
    assert m_type == BINDING_SUCCESS, f"STUN Binding failed: expected 0x0101, got 0x{m_type:04x}"
    assert resp_tx == tx_id, "STUN Transaction ID mismatch"
    print(f"[+] STEP 1 PASS: STUN UDP Binding Success (0x0101) on {host}:{port}")

    # 2. Initial Unauthenticated TURN Allocate Request (Expect 401 Unauthorized)
    tx_id_alloc = os.urandom(12)
    # Requested transport = UDP (protocol 17 = 0x11, 3 bytes zeroes)
    body_alloc1 = build_attr(ATTR_REQUESTED_TRANSPORT, struct.pack("!B3s", 17, b"\x00\x00\x00"))
    hdr_alloc1 = struct.pack("!HHI", ALLOCATE_REQUEST, len(body_alloc1), STUN_MAGIC) + tx_id_alloc
    m_type, magic, resp_tx, attrs = send_recv_turn(sock, host, port, hdr_alloc1 + body_alloc1)
    
    assert m_type == ALLOCATE_ERROR, f"Expected 401 Allocate Error (0x0113), got 0x{m_type:04x}"
    assert ATTR_REALM in attrs, "Missing REALM attribute in 401 response"
    assert ATTR_NONCE in attrs, "Missing NONCE attribute in 401 response"
    
    realm_str = attrs[ATTR_REALM].decode("utf-8", errors="ignore")
    nonce_bytes = attrs[ATTR_NONCE]
    print(f"[+] STEP 2 PASS: Received 401 challenge with REALM='{realm_str}'")

    # 3. Authenticated Allocate Request
    tx_id_auth = os.urandom(12)
    stun_key = compute_stun_key(user, realm_str, password)

    attrs_to_sign = [
        (ATTR_REQUESTED_TRANSPORT, struct.pack("!B3s", 17, b"\x00\x00\x00")),
        (ATTR_LIFETIME, struct.pack("!I", 600)),
        (ATTR_USERNAME, user.encode("utf-8")),
        (ATTR_REALM, realm_str.encode("utf-8")),
        (ATTR_NONCE, nonce_bytes),
    ]

    body_payload = b""
    for a_type, a_val in attrs_to_sign:
        body_payload += build_attr(a_type, a_val)

    # Length for HMAC calculation includes MESSAGE-INTEGRITY attribute header (4 bytes) + 20 bytes hash = 24 bytes
    mi_len = len(body_payload) + 24
    hdr_for_hmac = struct.pack("!HHI", ALLOCATE_REQUEST, mi_len, STUN_MAGIC) + tx_id_auth
    msg_to_hmac = hdr_for_hmac + body_payload
    mi_hash = hmac.new(stun_key, msg_to_hmac, hashlib.sha1).digest()
    body_payload += build_attr(ATTR_MESSAGE_INTEGRITY, mi_hash)

    # Calculate final FINGERPRINT (CRC32 ^ 0x5354554e)
    final_len = len(body_payload) + 8  # 4-byte header + 4-byte CRC
    hdr_final = struct.pack("!HHI", ALLOCATE_REQUEST, final_len, STUN_MAGIC) + tx_id_auth
    crc = (binascii.crc32(hdr_final + body_payload) & 0xFFFFFFFF) ^ 0x5354554E
    full_alloc_req = hdr_final + body_payload + build_attr(ATTR_FINGERPRINT, struct.pack("!I", crc))

    m_type, magic, resp_tx, attrs = send_recv_turn(sock, host, port, full_alloc_req)
    if m_type != ALLOCATE_SUCCESS:
        err_msg = ""
        if ATTR_ERROR_CODE in attrs:
            err_code_val = attrs[ATTR_ERROR_CODE]
            code = err_code_val[2] * 100 + err_code_val[3]
            reason = err_code_val[4:].decode("utf-8", errors="ignore")
            err_msg = f"Code: {code}, Reason: {reason}"
        raise RuntimeError(f"TURN Allocate Request failed with type 0x{m_type:04x}. {err_msg}")

    assert resp_tx == tx_id_auth, "Transaction ID mismatch on Allocate Success"
    assert ATTR_XOR_RELAYED_ADDRESS in attrs, "Missing XOR-RELAYED-ADDRESS in Allocate Success!"

    relayed_ip, relayed_port = decode_xor_address(attrs[ATTR_XOR_RELAYED_ADDRESS], magic, tx_id_auth)
    print(f"[+] STEP 3 PASS: Coturn Allocation Success (0x0103)!")
    print(f"    Relayed Address: {relayed_ip}:{relayed_port}")

    # Assert relayed port is within configured Coturn min-port/max-port (49152..49252)
    assert 49152 <= relayed_port <= 49252, (
        f"Relayed port {relayed_port} outside expected range [49152, 49252]!"
    )
    print(f"[+] STEP 4 PASS: Relayed port {relayed_port} strictly confirmed within [49152, 49252]")

    # 4. Clean Deallocation (Refresh Request with LIFETIME=0)
    tx_id_dealloc = os.urandom(12)
    dealloc_attrs = [
        (ATTR_LIFETIME, struct.pack("!I", 0)),
        (ATTR_USERNAME, user.encode("utf-8")),
        (ATTR_REALM, realm_str.encode("utf-8")),
        (ATTR_NONCE, nonce_bytes),
    ]
    body_dealloc = b""
    for a_type, a_val in dealloc_attrs:
        body_dealloc += build_attr(a_type, a_val)

    mi_len = len(body_dealloc) + 24
    hdr_dealloc_hmac = struct.pack("!HHI", REFRESH_REQUEST, mi_len, STUN_MAGIC) + tx_id_dealloc
    mi_hash = hmac.new(stun_key, hdr_dealloc_hmac + body_dealloc, hashlib.sha1).digest()
    body_dealloc += build_attr(ATTR_MESSAGE_INTEGRITY, mi_hash)

    final_len = len(body_dealloc) + 8
    hdr_dealloc_final = struct.pack("!HHI", REFRESH_REQUEST, final_len, STUN_MAGIC) + tx_id_dealloc
    crc = (binascii.crc32(hdr_dealloc_final + body_dealloc) & 0xFFFFFFFF) ^ 0x5354554E
    full_dealloc_req = hdr_dealloc_final + body_dealloc + build_attr(ATTR_FINGERPRINT, struct.pack("!I", crc))

    m_type, magic, resp_tx, attrs = send_recv_turn(sock, host, port, full_dealloc_req)
    assert m_type == REFRESH_SUCCESS, f"Expected Refresh Success (0x0104), got 0x{m_type:04x}"
    print(f"[+] STEP 5 PASS: Clean TURN Deallocation verified (LIFETIME=0 returned 0x0104)")
    print("[SUCCESS] All Coturn STUN/TURN Allocation checks PASSED 100%!")


if __name__ == "__main__":
    main()
