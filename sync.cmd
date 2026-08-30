@echo off
rem ローカルの変更を自動で commit / push します。止めるときは Ctrl+C。
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\auto-sync.ps1" %*
pause
