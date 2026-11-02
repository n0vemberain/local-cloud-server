# Local Cloud Server for Windows

A native Windows desktop application and NSIS installer (`.exe`) that turns any Windows 10/11 PC into a private, self-hosted cloud storage server with zero terminal commands.

---

## Highlights

- **Double-Click & Run**: No need to open Command Prompt or PowerShell, or run `node server/index.js`. Simply open the application from your Desktop or Start Menu.
- **Windows NSIS Installer**: Standard setup wizard with custom directory choice, Desktop shortcut, Start Menu shortcut, and automatic uninstaller.
- **Automatic Wi-Fi Discovery**: Automatically identifies your active local network Wi-Fi / LAN IP address and generates a scannable QR code for instant mobile phone connection.
- **Worldwide Remote Access**: Built-in encrypted Cloudflare Tunnel client (`cloudflared.exe`) generates an instant secure public HTTPS URL (`https://...trycloudflare.com`) with a remote QR code. Share with anyone across 4G, 5G, or any external network with zero router port forwarding.
- **Windows System Tray Integration**: Minimizes to the Windows Notification Area (System Tray). Closing the main window keeps the server active in the background. Left-click or right-click the tray icon anytime to copy URLs, restart, or open the dashboard.
- **Single-Instance Protection**: Prevents duplicate server processes on Windows; launching the application while it is already active instantly restores and focuses the existing window.
- **Windows 10/11 Native Titlebar Overlay**: Seamless dark glassmorphic window header with native Windows minimize, maximize, and close buttons integrated via `titleBarOverlay`.
- **Collapsible Sidebar**: Clean, space-saving sidebar with smooth animation, left-edge floating expand tab, and persistence across sessions.
- **Enhanced Video Streaming**: Smooth HTTP 206 partial-range video streaming and real-time transcoding with bundled FFmpeg, supporting MP4, MKV, WebM, MOV, and AVI.
- **File Explorer Integration**: Instant "Reveal in File Explorer" button opens the shared folder directly in Windows Explorer.
- **Launch on Windows Startup**: Optional preference to start automatically whenever your Windows PC boots up or logs in.

---

## Download & Installation

You can download the compiled Windows installer directly from the [GitHub Releases page](https://github.com/n0vemberain/local-cloud-server/releases):

- **Direct Download Link**: [Local-Cloud-Server-1.0.0-Windows-x64.exe](https://github.com/n0vemberain/local-cloud-server/releases/download/v1.0.0/Local-Cloud-Server-1.0.0-Windows-x64.exe)

### Installation Steps:
1. Download `Local-Cloud-Server-1.0.0-Windows-x64.exe`.
2. Double-click the `.exe` installer.
3. Follow the setup wizard to install **Local Cloud Server** to your desired folder.
4. Launch **Local Cloud Server** from your Desktop shortcut or Start Menu.
5. The local cloud server is now running automatically in your Windows notification tray.

---

## Default Administrator Credentials

| Field | Value | Notes |
|---|---|---|
| **Username** | `admin` | Master administrator |
| **Password** | `win1234` | Change anytime from Dashboard -> Settings -> Security (also supports `mac1234`) |
| **Default Port** | `7890` | Can be adjusted in app Preferences |

---

## Development & Building from Source

All source code for the Windows desktop app resides inside `LocalServerWindows`:

```bash
cd "LocalServerWindows"

# Run automated tests
npm test

# Run app in development mode
npm start

# Build Windows NSIS installer (.exe)
npm run build:win

# Build Portable executable (.exe)
npm run build:portable
```

---

## Architecture & Code Structure

- **`main.js`**: Electron main process managing Windows lifecycle, single-instance lock, system tray icon, auto-start, and native titlebar overlay controls.
- **`preload.js`**: Context-isolated secure IPC bridge exposing local server controls, Windows platform detection, and system metrics.
- **`server/`**: Standalone backend runtime ported for Windows packaging, utilizing `%APPDATA%\Local Cloud Server\data` for isolated persistent storage and unpacked binary resolution.
- **`server/paths.js`**: Windows binary resolver for `cloudflared.exe` and `ffmpeg.exe` with ASAR unpacked directory support.
- **`renderer/`**: Modern Windows GUI control panel with responsive collapsible navigation, Segoe UI typography, dark theme glassmorphism, and live status charts.
- **`bin/`**: Bundled PE32+ 64-bit Windows binary (`cloudflared.exe`).
- **`build/`**: High-resolution multi-size Windows icon (`icon.ico` with 16, 24, 32, 48, 64, 128, 256 px).
