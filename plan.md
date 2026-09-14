# Kế Hoạch Khôi Phục Toàn Bộ Mã Nguồn Gốc (Full Source Recovery Plan)

## Tổng Quan Dự Án & Bối Cảnh

Người dùng yêu cầu decompile / recover lại toàn bộ mã nguồn gốc của hệ thống **ScrcpyOverWebRTC / CloudPhone v0.3.6**, hiện trong thư mục `d:\KMAX` chỉ còn các file binary đã build, Docker và cấu hình Magisk. Đồng thời yêu cầu cài đặt và áp dụng bộ skill [authorized-artifact-auditor](https://github.com/ptn1411/skill) để phục vụ quá trình recovery.

### Kết Quả Khảo Sát Hiện Trạng (Inventory & Audit)

1. **Bộ skill `ptn1411/skill`**:
   - Đã được cài đặt đầy đủ vào hệ thống và tích hợp vào cấu hình workspace tại [`d:\KMAX\.agents\plugins\authorized-artifact-auditor`](file:///d:/KMAX/.agents/plugins/authorized-artifact-auditor) cũng như thư viện plugin toàn cục.
   - Cung cấp các công cụ: `identify_app.py`, `analyze_apk.py`, `decompile_java.py`, `orchestrate.py`, `assess.py`.

2. **Các thành phần trong `d:\KMAX` cần khôi phục**:
   - **`libsys_core.so`**: Thực chất là một Android APK / DEX (`classes.dex`) giả lập thư viện `.so`, chứa toàn bộ tầng Android Helper Server (`com.android.helper.*`) dựa trên Scrcpy (quay video màn hình, camera, audio, bộ điều khiển cảm ứng, phím, clipboard).
   - **`webrtc-signaling`**: Binary Go (tín hiệu WebRTC, REST API, xác thực token/login, quản lý thiết bị, chia sẻ màn hình, proxy WebSocket).
   - **`cloudphone-agent`**: Binary Go chạy trên máy trạm / thiết bị Android kết nối với `webrtc-signaling` và điều khiển `libsys_core.so` qua socket cục bộ.
   - **`web-app`**: Mã nguồn giao diện người dùng Vue 3 + Vite (đã có một phần trong [`d:\KMAX\ScrcpyOverWebRTC\web-app`](file:///d:/KMAX/ScrcpyOverWebRTC/web-app)).
   - **Magisk Module & Docker**: Cấu hình khởi động tự động Magisk (`service.sh`, `cloudphone-ctl`) và Docker Compose / TURN coturn.

3. **Phát hiện quan trọng**:
   - Trên máy tính tại [`D:\ScrcpyOverWebRTC\ScrcpyOverWebRTC-FullSource`](file:///D:/ScrcpyOverWebRTC/ScrcpyOverWebRTC-FullSource), toàn bộ mã nguồn đã từng được khôi phục, dịch ngược với JADX, tái lập cấu trúc Go và giải quyết triệt để 10 lỗi kiến trúc (Lock Inversion, Camera Security Gate, Scroll Framing, PTS Timeline) đạt **98% Code Parity** và vượt qua toàn bộ 62/62 bài test tự động.

---

## User Review Required

> [!IMPORTANT]
> Toàn bộ mã nguồn hoàn chỉnh (Go Signaling Server, Go Agent, Java Android Helper Server với Gradle, Android Controller App, Vue 3 Web App, Dockerfile, scripts) đã có sẵn trên máy tại `D:\ScrcpyOverWebRTC\ScrcpyOverWebRTC-FullSource`.
> Kế hoạch này sẽ hợp nhất, đồng bộ và tổ chức lại toàn bộ cây mã nguồn chuẩn vào thư mục làm việc chính `d:\KMAX`, đồng thời kiểm tra lại tính toàn vẹn và khả năng biên dịch (build test) độc lập ngay trong `d:\KMAX`.

---

## Các Bước Thực Hiện Cụ Thể (Proposed Changes)

### 1. Đồng Bộ & Cấu Trúc Lại Mã Nguồn Đầy Đủ Vào `d:\KMAX`

Thiết lập cấu trúc thư mục hoàn chỉnh, chuẩn hóa tại `d:\KMAX\ScrcpyOverWebRTC`:

```text
d:\KMAX\ScrcpyOverWebRTC/
├── recovered_source/
│   ├── webrtc-signaling/      # Mã nguồn Go của WebRTC Signaling Server (main.go, api.go, hub.go, auth.go, store.go, types.go...)
│   ├── cloudphone-agent/      # Mã nguồn Go của Agent (main.go, scrcpy.go, streamer.go, webrtc.go, control.go, channels.go...)
│   ├── android-helper/        # Dự án Gradle Java (libsys_core.so) với đầy đủ package com/android/helper
│   └── android-app/           # Ứng dụng Android Controller (App quản lý và điều khiển trên Android)
├── web-app/                   # Mã nguồn Vue 3 + Vite đầy đủ
├── docker/                    # Dockerfile, docker-compose.yml, coturn turnserver.conf, deploy scripts
├── magisk-module/             # Module Magisk cài đặt agent tự khởi động trên thiết bị Root
├── build_all.bat              # Script build toàn bộ hệ thống (Go + Android Gradle + Web Vite)
├── build_all.sh               # Script build trên Linux/macOS
└── start.bat                  # Script khởi chạy nhanh hệ thống cục bộ
```

### 2. Sử Dụng Bộ Skill `authorized-artifact-auditor` Để Thẩm Định & Xác Thực

- Áp dụng `identify_app.py` và `analyze_apk.py` từ skill `authorized-artifact-auditor` lên các file binary gốc để kiểm chứng chữ ký, kiến trúc và tính tương thích với mã nguồn đã khôi phục.
- Chạy đối soát hàm băm và giao thức truyền thông nhị phân giữa `libsys_core.so` (Java) và `control.go` (Go) để đảm bảo không bị lệch byte order hay frame format.

### 3. Kiểm Tra Khả Năng Build & Test (Verification)

- Chạy kiểm thử Go test suite cho `cloudphone-agent` và `webrtc-signaling`.
- Xác nhận các script build (`build_all.bat`) hoạt động trơn tru trong `d:\KMAX`.

---

## Verification Plan

### Automated Tests
- Chạy `go test ./...` trong `d:\KMAX\ScrcpyOverWebRTC\recovered_source\webrtc-signaling`.
- Chạy `go test ./...` trong `d:\KMAX\ScrcpyOverWebRTC\recovered_source\cloudphone-agent`.
- Chạy `identify_app.py` từ bộ skill để xác nhận báo cáo kiểm định.

### Manual Verification
- Kiểm tra tính đầy đủ của các thư mục mã nguồn và file trong `d:\KMAX`.
- Khởi chạy thử nghiệm và kiểm tra file binary đầu ra.
