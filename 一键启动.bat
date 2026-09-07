@echo off
rem One-click launch of Pixel Town: starts the dev server and opens the browser.
rem Equivalent to: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-app.ps1
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-app.ps1"