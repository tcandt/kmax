@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo    ScrcpyOverWebRTC - Khoi chay he thong
echo =======================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

rem Kiem tra neu webrtc-signaling.exe chua duoc build
if not exist "%ROOT_DIR%recovered_source\webrtc-signaling\webrtc-signaling.exe" (
    echo [1/2] Dang bien dich webrtc-signaling.exe...
    cd "%ROOT_DIR%recovered_source\webrtc-signaling"
    go build -ldflags="-s -w" -o webrtc-signaling.exe .
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Bien dich signaling server that bai!
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)

rem Kiem tra neu frontend assets chua duoc build
if not exist "%ROOT_DIR%assets\index.html" (
    echo [2/2] Dang bien dich Web Frontend (assets)...
    cd "%ROOT_DIR%web-app"
    call npm install
    call npm run build
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Bien dich frontend that bai!
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)

echo.
echo =======================================================
echo  [OK] He thong da san sang!
echo  Dia chi truy cap Web: http://localhost:8443
echo  Tai khoan dang nhap:  admin
echo  Mat khau mac dinh:    admin123
echo =======================================================
echo.

set DEV_MODE=true
"%ROOT_DIR%recovered_source\webrtc-signaling\webrtc-signaling.exe" -port 8443 -assets "%ROOT_DIR%assets" -data "%ROOT_DIR%data" -downloads "%ROOT_DIR%downloads" -debug
