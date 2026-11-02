# Local Cloud Server

A lightweight, self-hosted personal cloud that turns your computer into a private cloud storage server. Access, stream, edit, upload, and download your files remotely from any smartphone, tablet, or PC over your local Wi-Fi or across the internet with zero router configuration.

---

## Repository Structure

- **`LocalServerCodebase/`**: Core Node.js backend server, web dashboard, API handlers, and assets.
- **`LocalServerMacOs/`**: Dedicated macOS native desktop application (Electron), source code, and assets.
- **`LocalServerWindows/`**: Dedicated Windows build assets and executables.

---

## Downloads & Releases

Pre-compiled standalone desktop installers are available via **[GitHub Releases](https://github.com/n0vemberain/local-cloud-server/releases)**:

| Platform | Version | Architecture | Package Type | Direct Download Link |
|---|---|---|---|---|
| **macOS** | `v1.0.0` | Apple Silicon (`arm64` / M1, M2, M3, M4) | Apple Disk Image (`.dmg`) | [Download DMG (v1.0.0)](https://github.com/n0vemberain/local-cloud-server/releases/download/v1.0.0/Local-Cloud-Server-1.0.0-macOS-arm64.dmg) |

> [!TIP]
> Download the `.dmg` file, open it in Finder, drag **Local Cloud Server** to your **Applications** folder, and launch it directly. No terminal commands required.

---

## macOS Native Application Features

For MacBook and Mac desktop users:
- **Zero Terminal Requirement**: Just double-click the app to start the server.
- **Auto Wi-Fi Detection & QR Code**: Instantly scans your local Wi-Fi interface and renders a QR code for mobile devices.
- **Encrypted Remote Tunneling**: Auto-initializes Cloudflare Tunnel for worldwide secure access with remote QR code.
- **Collapsible Sidebar**: Modern collapsible navigation sidebar with smooth animations and edge trigger tab.
- **High-Performance Video Streaming**: Native HTTP 206 partial-range video streaming and real-time transcoding for MKV/MP4/MOV/AVI.
- **macOS Menu Bar Tray**: Runs quietly in the status bar even when the window is closed, preventing accidental server stops.
- **Retina SVG UI**: Modern clean styling without emojis.



---

## What Can You Do With It?

- **Access Your Files Anywhere**: Connect securely over local Wi-Fi or across the internet via encrypted Cloudflare Tunnels (no public IP or router port forwarding needed).
- **Stream & Preview Media**: Stream video and audio directly in your browser, view photos, and read documents without downloading them first.
- **In-Browser Code & Text Editor**: View and edit scripts, code, and text files directly from your mobile device or laptop with instant saving.
- **Multi-User Access & Granular Permissions**: Create guest accounts for clients, friends, or family with access restricted to specific folders and permissions (download, upload, edit, delete).
- **Download Tracking & Notifications**: Monitor who downloads what in real time with detailed file auditing and approval workflows for permission requests.
- **Built-in Chat & Messaging**: Send direct messages between admin and guest users, with automatic mark-as-read on reply.
- **One-Click Session Management**: View all connected devices and disconnect any session immediately.

---

## Interface Preview

![Personal Cloud Server Interface - 01](LocalServerCodebase/images/01.png)

![Personal Cloud Server Interface - 02](LocalServerCodebase/images/02.png)

![Personal Cloud Server Interface - 03](LocalServerCodebase/images/03.png)

![Personal Cloud Server Interface - 04](LocalServerCodebase/images/04.png)

![Personal Cloud Server Interface - 05](LocalServerCodebase/images/05.png)

![Personal Cloud Server Interface - 06](LocalServerCodebase/images/06.png)

![Personal Cloud Server Interface - 07](LocalServerCodebase/images/07.png)

![Personal Cloud Server Interface - 08](LocalServerCodebase/images/08.png)

![Personal Cloud Server Interface - 09](LocalServerCodebase/images/09.png)

![Personal Cloud Server Interface - 10](LocalServerCodebase/images/10.png)

---

## Quick Start

### 1. Clone & Navigate to Codebase
```bash
git clone https://github.com/n0vemberain/local-cloud-server.git
cd local-cloud-server/LocalServerCodebase
npm install
```

### 2. Start the Server

- **macOS / Linux**:
  ```bash
  npm start
  ```
  or
  ```bash
  ./start.sh
  ```
  

- **Windows**:
  ```cmd
  start.bat
  ```

### 3. Log In

Open the URL shown in the terminal (Local URL or Remote URL) or scan the terminal QR code from your mobile device:

| Field | Default Value | Notes |
|---|---|---|
| **Username** | `admin` | Default master administrator username |
| **Password** | `mac1234` | Change anytime in Settings -> Security |

---

## Tech Stack

- **Backend**: Node.js, Express.js
- **Tunneling**: Cloudflare Tunnel (`cloudflared`)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (responsive glassmorphism UI)
- **Security**: HMAC-SHA256 session tokens, instant session revocation, directory sandboxing

---

## Contact & Support

- **Author**: Fatin Ishraque
- **Email**: [fatinishraque2@gmail.com](mailto:fatinishraque2@gmail.com)
- **GitHub**: [github.com/n0vemberain](https://github.com/n0vemberain)
- **Repository**: [github.com/n0vemberain/local-cloud-server](https://github.com/n0vemberain/local-cloud-server)
