#!/usr/bin/env python3
"""
Lightweight, zero-dependency RFC 6455 WebSocket client implementation
supporting SSL/TLS, 101 Switching Protocols upgrade, client frame masking,
and text framing for E2E integration testing.
"""

import base64
import os
import socket
import ssl
import struct


class SimpleWebSocket:
    def __init__(self, host: str, port: int, path: str, use_ssl: bool = True, timeout: float = 10.0):
        self.host = host
        self.port = port
        self.path = path
        self.leftover = b""
        raw_sock = socket.create_connection((host, port), timeout=timeout)
        if use_ssl:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            self.sock = ctx.wrap_socket(raw_sock, server_hostname=host)
        else:
            self.sock = raw_sock

        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode("utf-8"))

        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = self.sock.recv(4096)
            if not chunk:
                break
            resp += chunk

        parts = resp.split(b"\r\n\r\n", 1)
        header_part = parts[0]
        self.leftover = parts[1] if len(parts) > 1 else b""
        first_line = header_part.split(b"\r\n")[0].decode("utf-8", errors="ignore")
        self.status_line = first_line

        if "101" not in first_line:
            raise ConnectionError(f"WebSocket Upgrade failed: {first_line}")

    def send_text(self, text: str):
        payload = text.encode("utf-8")
        mask = os.urandom(4)
        masked = bytes([b ^ mask[i % 4] for i, b in enumerate(payload)])
        length = len(payload)
        if length < 126:
            hdr = struct.pack("!BB", 0x81, 0x80 | length) + mask
        elif length < 65536:
            hdr = struct.pack("!BBH", 0x81, 0x80 | 126, length) + mask
        else:
            hdr = struct.pack("!BBQ", 0x81, 0x80 | 127, length) + mask
        self.sock.sendall(hdr + masked)

    def recv_text(self, timeout: float = 10.0) -> str:
        self.sock.settimeout(timeout)
        buf = self.leftover
        self.leftover = b""
        while True:
            while len(buf) < 2:
                chunk = self.sock.recv(4096)
                if not chunk:
                    raise EOFError("WebSocket socket closed by remote peer")
                buf += chunk
            b1, b2 = buf[0], buf[1]
            opcode = b1 & 0x0F
            is_masked = bool(b2 & 0x80)
            plen = b2 & 0x7F
            idx = 2
            if plen == 126:
                while len(buf) < idx + 2:
                    chunk = self.sock.recv(4096)
                    if not chunk:
                        raise EOFError("Unexpected EOF while reading extended length")
                    buf += chunk
                plen = struct.unpack("!H", buf[idx : idx + 2])[0]
                idx += 2
            elif plen == 127:
                while len(buf) < idx + 8:
                    chunk = self.sock.recv(4096)
                    if not chunk:
                        raise EOFError("Unexpected EOF while reading 64-bit length")
                    buf += chunk
                plen = struct.unpack("!Q", buf[idx : idx + 8])[0]
                idx += 8

            mask = None
            if is_masked:
                while len(buf) < idx + 4:
                    chunk = self.sock.recv(4096)
                    if not chunk:
                        raise EOFError("Unexpected EOF while reading mask")
                    buf += chunk
                mask = buf[idx : idx + 4]
                idx += 4

            while len(buf) < idx + plen:
                chunk = self.sock.recv(4096)
                if not chunk:
                    raise EOFError("Unexpected EOF while reading payload")
                buf += chunk

            payload = buf[idx : idx + plen]
            self.leftover = buf[idx + plen :]

            if mask:
                payload = bytes([b ^ mask[i % 4] for i, b in enumerate(payload)])

            if opcode == 0x01:  # Text frame
                return payload.decode("utf-8")
            elif opcode == 0x08:  # Close frame
                raise ConnectionResetError(f"Received WebSocket close frame (opcode 0x08)")
            elif opcode == 0x09:  # Ping -> reply with Pong (0x8A)
                mask = os.urandom(4)
                pong = struct.pack("!BB", 0x8A, 0x80) + mask
                self.sock.sendall(pong)
            # Other opcodes: continue to next frame

    def close(self):
        try:
            mask = os.urandom(4)
            self.sock.sendall(struct.pack("!BB", 0x88, 0x80) + mask)
            self.sock.close()
        except Exception:
            pass
