@echo off
REM Mo firewall cho dev server (port 5180-5185) de dien thoai cung Wi-Fi vao duoc.
>nul 2>&1 net session
if %errorlevel% neq 0 (
    echo Dang xin quyen Admin...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
netsh advfirewall firewall delete rule name="Ball Sort Dev" >nul 2>&1
netsh advfirewall firewall add rule name="Ball Sort Dev" dir=in action=allow protocol=TCP localport=5180-5185 profile=any
echo Xong. Chay "npm run dev" roi mo dia chi LAN tren dien thoai.
pause
