# Local Cloud Server for macOS

A native macOS desktop application and `.dmg` installer that turns your MacBook into a private, self-hosted cloud storage server with zero terminal commands.

---

## Highlights

- **Double-Click & Run**: No need to open Terminal or type `node server/index.js`. Simply open the application from your Applications folder or Dock.
- **Automatic Wi-Fi Connection**: Automatically discovers your local network Wi-Fi IP address and displays a scannable QR code for instant mobile access from your iPhone, iPad, or Android phone.
- **Worldwide Remote Access**: Built-in encrypted Cloudflare Tunnel generates a secure public HTTPS link (`https://...trycloudflare.com`) with a remote QR code. Share the link with anyone to grant remote access across 4G, 5G, or any external network with zero router port forwarding.
- **Menu Bar Tray Integration**: Runs quietly in the macOS top Menu Bar. Closing the main window keeps the server active in the background. Click the menu bar icon anytime to copy URLs, restart, or open the dashboard.
- **Collapsible Sidebar**: Clean, space-saving sidebar with smooth animation, left-edge floating expand tab, and persistence across sessions so you have maximum screen real estate.
- **Enhanced Video Streaming**: Smooth HTTP 206 partial-range video streaming and real-time transcoding with bundled FFmpeg, supporting MP4, MKV, WebM, MOV, and AVI.
- **Native Fullscreen Safety**: Handles macOS native fullscreen transitions gracefully without black screens or freezes on window close.
- **Clean Interface (No Emojis)**: Crisp, modern UI built with high-definition retina SVG icons.
- **In-App Cloud Browser**: Browse, upload, stream, and manage your cloud files directly inside the desktop app, or click "Open in Browser" to launch Safari/Chrome.
- **Live Terminal & Diagnostics**: Real-time console logs displaying incoming HTTP requests, connected guest sessions, active downloads, and tunnel events.
- **Launch at Mac Login**: Optional preference to start automatically whenever your MacBook boots up.

---

## How to Install the DMG

The installer is located inside `LocalServerMacOs/release`:

```
LocalServerMacOs/release/Local Cloud Server-1.0.0-macOS-arm64.dmg
```

1. Double-click `Local Cloud Server-1.0.0-macOS-arm64.dmg` in Finder (inside `LocalServerMacOs/release`).
2. Drag **Local Cloud Server** into the **Applications** folder shortcut.
3. Open **Local Cloud Server** from Applications, Launchpad, or Spotlight (`Cmd + Space`).
4. That's it! Your local cloud server is now running.

---

## Default Administrator Credentials

| Field | Value | Notes |
|---|---|---|
| **Username** | `admin` | Master administrator |
| **Password** | `mac1234` | Change anytime from Dashboard -> Settings -> Security |
| **Default Port** | `7890` | Can be adjusted in app Preferences |

---

## Development & Building from Source

All source code for the macOS desktop app resides inside `LocalServerMacOs`:

```bash
cd "LocalServerMacOs"

# Run automated tests
npm test

# Run app in development mode
npm start

# Build a new DMG installer
npm run build:dmg
```

---

## Architecture & Code Structure

- **`main.js`**: Electron main process managing lifecycle, single-instance lock, menu bar tray, auto-start, and graceful fullscreen handling.
- **`preload.js`**: Context-isolated secure IPC bridge exposing local server controls and system metrics.
- **`server/`**: Standalone backend runtime ported for macOS packaging, utilizing `~/Library/Application Support/Local Cloud Server/` for isolated persistent storage and unpacked binary resolution.
- **`renderer/`**: Desktop GUI control panel with responsive collapsible navigation, dark theme glassmorphism, and live status charts.

