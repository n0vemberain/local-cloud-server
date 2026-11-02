# Personal Cloud Server — macOS Application Test Report

**Application Name:** Local Cloud Server for macOS  
**Package Type:** Apple Silicon (`arm64`) macOS DMG Installer  
**Version:** 1.0.0  
**Test Date:** November 3, 2026  
**Target OS Tested:** macOS Darwin 25.6.2 (Apple Silicon M-series)  
**Node.js Runtime:** v22.18.0 / Electron v45.2.1  

---

## Executive Summary

The transition of the Local Server web application into a native macOS `.dmg` installer application has been executed and verified. The user can now double-click the DMG, drag `Local Cloud Server.app` into `/Applications`, and launch it without opening the terminal. Upon launch, the app automatically connects to the local Wi-Fi, resolves the local LAN IP, starts the HTTP server, and initializes the secure Cloudflare tunnel for remote worldwide access.

---

## Fullscreen Close & Video Streaming Resolution

- **macOS Fullscreen Black Screen Bug Fixed**:
  - Root Cause: In macOS Mission Control spaces, calling `mainWindow.hide()` while in native fullscreen hid the window but left the dedicated virtual fullscreen space active and empty, resulting in an unclosable pitch black screen.
  - Solution: In `main.js`, intercepting the window `close` event now checks `mainWindow.isFullScreen()`. If true, it calls `mainWindow.setFullScreen(false)` and waits for the macOS `'leave-full-screen'` transition before hiding to the tray, accompanied by a safety fallback timer.
- **Cloud Video Playback Fixed**:
  - Root Cause: In packaged Electron (`app.asar`), `import ffmpegPath from 'ffmpeg-static'` pointed inside `app.asar`, which threw `Error: spawn ENOTDIR` when executed because macOS cannot spawn binaries from inside an ASAR archive. Consequently, `probeMediaFile` crashed, failing container/codec probing, and real-time transmuxing for browser-incompatible videos (MKV, AVI, WMV, FLV, non-AAC audio) failed.
  - Solution: 
    1. Implemented `getFfmpegBin()` in `paths.js` and `streamHandler.js` to correctly resolve to the unpacked binary in `app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg`.
    2. Added real-time on-the-fly H.264 copy & AAC stereo transmuxing so any video format plays in browsers without stutter.
    3. Added fallback transcode retry on `<video>` playback error in `public/app.js`.
    4. Added HTTP 206 Partial Content range streaming with `Accept-Ranges: bytes` for native MP4/WebM/MOV scrubbing.
- **Output Directory**: Updated DMG build location to `release/Local Cloud Server-1.0.0-macOS-arm64.dmg`.

---

## UI Updates & Collapsible Sidebar Verification

- **Collapsible Sidebar**: Implemented dynamic sidebar toggling with multiple intuitive triggers:
  - Header Toggle Button: Mac-native sidebar toggle icon (`#btn-toggle-sidebar`) next to traffic lights.
  - Sidebar Collapse Button: Direct collapse arrow (`#btn-collapse-sidebar`) inside the sidebar navigation header.
  - Floating Expand Tab: A subtle floating toggle tab (`#btn-expand-sidebar-floating`) on the left edge when collapsed.
  - Smooth animation (`cubic-bezier(0.16, 1, 0.3, 1)`) and automatic 100% full-width expansion for the content area and Cloud Web App iframe.
  - State persistence via `localStorage` (`sidebar_collapsed`).
- **Emoji Removal**: Replaced all emojis throughout the application with clean, crisp, native vector SVGs (Cloud, Stop/Start, Wi-Fi signal, Worldwide Globe, Refresh, External links) and text labels.
- **Packaging & Build**: Tested and rebuilt into DMG `Local Cloud Server-1.0.0-macOS-arm64.dmg`.

---

## Bug Fix & Packaging Verification (ENOTDIR Resolution)

- **Issue Identified**: In packaged Electron (`app.asar`), ES module top-level imports in `sessionTracker.js` attempted to call `mkdirSync` on `app.asar/data` before `process.env.LOCAL_SERVER_DATA_DIR` was assigned, resulting in `Error: ENOTDIR: not a directory, mkdir '.../app.asar/data'`.
- **Resolution**: Updated `server/paths.js` to automatically detect packaged ASAR runtime (`__filename.includes('.asar') || process.versions.electron`) and immediately resolve data storage to standard macOS user directory (`~/Library/Application Support/Local Cloud Server/data`). Wrapped module-level session initializers with defensive error handling.
- **Verification Result**: Verified with `ELECTRON_RUN_AS_NODE` directly against the packaged `app.asar` inside the freshly generated DMG. Module initialization completed with exit code `0` and confirmed writable data path at `~/Library/Application Support/Local Cloud Server/data`.

---

## Automated Test Results (28 / 28 Tests Passed)

| # | Test Suite | Test Case Description | Result |
|---|---|---|:---:|
| 1 | File & Assets | `main.js` Electron entry point exists and is syntactically valid | **PASSED** |
| 2 | File & Assets | `preload.js` sandboxed context bridge exists | **PASSED** |
| 3 | File & Assets | `renderer/index.html` native UI layout exists | **PASSED** |
| 4 | File & Assets | `renderer/styles.css` macOS glassmorphism styling exists | **PASSED** |
| 5 | File & Assets | `renderer/app.js` renderer controller logic exists | **PASSED** |
| 6 | File & Assets | `public/index.html` web dashboard assets exist | **PASSED** |
| 7 | File & Assets | `build/icon.icns` multi-resolution macOS icon exists | **PASSED** |
| 8 | File & Assets | `assets/trayTemplate.png` monochrome menu bar icon exists | **PASSED** |
| 9 | File & Assets | `icon.icns` file size validation (> 100 KB multi-res) | **PASSED** |
| 10 | File & Assets | `bin/cloudflared` Mach-O 64-bit arm64 binary exists | **PASSED** |
| 11 | File & Assets | `bin/cloudflared` execution permissions verified (`+x`) | **PASSED** |
| 12 | Paths & Storage | `getDataDir()` respects `LOCAL_SERVER_DATA_DIR` dynamic path | **PASSED** |
| 13 | Paths & Storage | `getPublicDir()` resolves existing static assets directory | **PASSED** |
| 14 | Paths & Storage | `getCloudflaredBin()` resolves local and packaged paths | **PASSED** |
| 15 | Paths & Storage | `loadConfig()` successfully loads and creates JSON configuration | **PASSED** |
| 16 | Paths & Storage | PBKDF2 default master password hash verification (`mac1234`) | **PASSED** |
| 17 | Network & Wi-Fi | Local network interfaces enumerated (`en0` Wi-Fi prioritized) | **PASSED** |
| 18 | Network & Wi-Fi | Primary Wi-Fi IP address resolution verified | **PASSED** |
| 19 | Server Lifecycle | `serverController.start()` starts HTTP server and reports `running` | **PASSED** |
| 20 | Server Lifecycle | Server binds to requested port without collisions | **PASSED** |
| 21 | Server Lifecycle | Server emits real-time status update events | **PASSED** |
| 22 | Server Lifecycle | Generates valid Base64 PNG QR code for local Wi-Fi | **PASSED** |
| 23 | HTTP API | `GET /api/auth/status` returns `200 OK` with session payload | **PASSED** |
| 24 | HTTP API | Unauthenticated state properly enforced for fresh sessions | **PASSED** |
| 25 | HTTP API | `GET /` serves responsive web app index | **PASSED** |
| 26 | HTTP API | HTML content contains Personal Cloud Server headers | **PASSED** |
| 27 | Server Lifecycle | `serverController.stop()` halts server and reports `stopped` | **PASSED** |
| 28 | Server Lifecycle | Port is released and accessible for subsequent launches | **PASSED** |

---

## DMG Package & Installation Verification

1. **DMG Build Verification:**
   - Output File: `release/Local Cloud Server-1.0.0-macOS-arm64.dmg`
   - File Size: `156 MB`
   - Format: UDZO (Apple zlib-compressed read-only image with GPT partition map)

2. **Mount Verification (`hdiutil attach`):**
   - MBR Checksum: `CRC32 $050A4A46` (Verified)
   - Primary GPT Header: `CRC32 $3F0A8782` (Verified)
   - Apple HFS Disk Image: `CRC32 $3A2C905F` (Verified)
   - Total Checksum: `CRC32 $22F9F253` (Verified)

3. **DMG Volume Layout:**
   - Volume Icon: `.VolumeIcon.icns` custom icon present
   - Application Symlink: `Applications -> /Applications` present for 1-click drag-to-install
   - App Bundle: `Local Cloud Server.app` present

4. **App Bundle Structure:**
   - `Contents/Info.plist`: Verified valid XML plist with `com.fatinishraque.localcloudserver`, `NSAllowsLocalNetworking = true`
   - `Contents/MacOS/Local Cloud Server`: Mach-O 64-bit arm64 executable
   - `Contents/Resources/bin/cloudflared`: Embedded Cloudflare tunnel binary
   - `Contents/Resources/app.asar`: Packaged backend, renderer, and web assets

---

## Feature Verification

- **Terminal-Free Operation:** User launches application directly from `/Applications` or Spotlight/Launchpad; the server starts in the background automatically.
- **Wi-Fi Connectivity:** Detects local IP (`http://192.168.x.x:7890`) and presents instant scannable QR code for iPhone/Android.
- **Remote Internet Access:** Starts Cloudflare tunnel and displays public HTTPS URL with one-click copy and remote QR code.
- **macOS Menu Bar (Tray):** Live tray icon with status, quick copy links, and controls. Window can be closed while server continues running in the background.
- **In-App Web View:** Embedded browser tab allows browsing files directly inside the desktop app.
- **Live Logs:** Real-time stream of HTTP requests, connected clients, downloads, and tunnel events.
