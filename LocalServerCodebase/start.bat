@echo off
title Personal Cloud Server
setlocal enabledelayedexpansion

echo ===================================================
echo           Starting Personal Cloud Server
echo ===================================================

:: Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in your PATH.
    echo Please download and install Node.js from: https://nodejs.org/
    echo After installing, restart this script.
    echo.
    pause
    exit /b 1
)

:: Ensure bin directory exists
if not exist "bin" (
    mkdir "bin"
)

:: Check and download cloudflared.exe if missing
if not exist "bin\cloudflared.exe" (
    echo [Tunnel] Downloading cloudflared tunnel client for Windows...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'bin\cloudflared.exe'"
    if exist "bin\cloudflared.exe" (
        echo [Tunnel] cloudflared.exe is ready.
    ) else (
        echo [Tunnel] Notice: Could not auto-download cloudflared.exe. Server will run in Local LAN mode.
    )
)

:: Install node dependencies if missing
if not exist "node_modules" (
    echo [Setup] Installing project dependencies...
    call npm install
)

echo.
echo [Server] Starting Cloud Server...
echo [Server] Local LAN address will be displayed upon launch.
echo [Server] Press Ctrl+C in this window anytime to stop the server.
echo.

node server/index.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server encountered an unexpected error.
    pause
)
