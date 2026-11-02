import './server/paths.js';
import { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { serverController } from './server/serverController.js';
import { loadConfig, saveConfig } from './server/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Application Paths
const userDataDir = app.getPath('userData');
const appDataDir = path.join(userDataDir, 'data');
if (!fs.existsSync(appDataDir)) {
  fs.mkdirSync(appDataDir, { recursive: true });
}

process.env.LOCAL_SERVER_DATA_DIR = appDataDir;
process.env.LOCAL_SERVER_PUBLIC_DIR = path.join(__dirname, 'public');

// Resolve cloudflared binary inside app bundle or dev directory
const devBin = path.join(__dirname, 'bin', 'cloudflared');
const resBin = process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'cloudflared') : null;
const unpackedBin = process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'cloudflared') : null;

if (unpackedBin && fs.existsSync(unpackedBin)) {
  process.env.CLOUDFLARED_BIN_PATH = unpackedBin;
} else if (resBin && fs.existsSync(resBin)) {
  process.env.CLOUDFLARED_BIN_PATH = resBin;
} else if (fs.existsSync(devBin)) {
  process.env.CLOUDFLARED_BIN_PATH = devBin;
}

// App Settings file
const SETTINGS_FILE = path.join(userDataDir, 'desktop_settings.json');
function loadDesktopSettings() {
  const defaults = {
    autoStartOnLaunch: true,
    autoTunnel: true,
    port: 7890,
    launchAtLogin: false,
    minimizeToTray: true,
    sharedFolder: app.getPath('home')
  };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
    }
  } catch (e) {}
  return defaults;
}

function saveDesktopSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving desktop settings:', e);
  }
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Set name
app.name = 'Local Cloud Server';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    title: 'Local Cloud Server',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 18 },
    backgroundColor: '#090d16',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Intercept close button to hide window instead of terminating server
  mainWindow.on('close', (e) => {
    const settings = loadDesktopSettings();
    if (!isQuitting && settings.minimizeToTray) {
      e.preventDefault();

      if (mainWindow.isFullScreen()) {
        // Must smoothly exit fullscreen first on macOS to prevent black screen lockup!
        let hasHidden = false;
        const safeHide = () => {
          if (!hasHidden) {
            hasHidden = true;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.hide();
            }
          }
        };

        mainWindow.once('leave-full-screen', () => {
          setTimeout(safeHide, 150);
        });

        mainWindow.setFullScreen(false);

        // Fallback safety timeout in case OS animation takes longer or fails to emit
        setTimeout(safeHide, 800);
      } else {
        mainWindow.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const trayIconPath = path.join(__dirname, 'assets', 'trayTemplate.png');
  if (fs.existsSync(trayIconPath)) {
    tray = new Tray(trayIconPath);
  } else {
    return;
  }

  tray.setToolTip('Local Cloud Server');
  updateTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) {
      createMainWindow();
    } else {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const status = serverController.getStatus();
  const isRunning = status.status === 'running';

  const statusLabel = isRunning
    ? `Server: Running (Port ${status.port})`
    : `Server: ${status.status === 'starting' ? 'Starting...' : 'Stopped'}`;

  const contextMenu = Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    {
      label: 'Copy Local Wi-Fi URL',
      enabled: isRunning && !!status.localUrl,
      click: () => {
        if (status.localUrl) clipboard.writeText(status.localUrl);
      }
    },
    {
      label: 'Copy Remote Public URL',
      enabled: isRunning && !!status.tunnel?.url,
      click: () => {
        if (status.tunnel?.url) clipboard.writeText(status.tunnel.url);
      }
    },
    {
      label: 'Open Web Dashboard in Browser',
      enabled: isRunning,
      click: () => {
        const url = status.localUrl || status.loopbackUrl;
        if (url) shell.openExternal(url);
      }
    },
    { type: 'separator' },
    {
      label: 'Show Local Server Window',
      click: () => {
        if (!mainWindow) {
          createMainWindow();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: isRunning ? 'Restart Server' : 'Start Server',
      click: async () => {
        if (isRunning) {
          await serverController.restart();
        } else {
          await serverController.start();
        }
      }
    },
    ...(isRunning
      ? [
          {
            label: 'Stop Server',
            click: async () => {
              await serverController.stop();
            }
          }
        ]
      : []),
    { type: 'separator' },
    {
      label: 'Quit Local Cloud Server',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function setupAppMenu() {
  const template = [
    {
      label: 'Local Cloud Server',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('navigate-to-settings');
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: 'Quit Local Cloud Server',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Server',
      submenu: [
        {
          label: 'Start Server',
          click: () => serverController.start()
        },
        {
          label: 'Stop Server',
          click: () => serverController.stop()
        },
        {
          label: 'Restart Server',
          click: () => serverController.restart()
        },
        { type: 'separator' },
        {
          label: 'Open Dashboard in Browser',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const st = serverController.getStatus();
            const url = st.localUrl || st.loopbackUrl;
            if (url) shell.openExternal(url);
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('server:get-status', () => serverController.getStatus());
ipcMain.handle('server:start', (_e, opts) => serverController.start(opts));
ipcMain.handle('server:stop', () => serverController.stop());
ipcMain.handle('server:restart', () => serverController.restart());
ipcMain.handle('tunnel:toggle', (_e, enable) => serverController.toggleTunnel(enable));

ipcMain.handle('shell:open-browser', (_e, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('shell:open-folder', (_e, dirPath) => {
  const target = dirPath || app.getPath('home');
  shell.openPath(target);
  return true;
});

ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('clipboard:write', (_e, text) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('settings:get', () => loadDesktopSettings());
ipcMain.handle('settings:save', (_e, settings) => {
  saveDesktopSettings(settings);

  // Apply launch at login
  if (typeof settings.launchAtLogin === 'boolean') {
    app.setLoginItemSettings({
      openAtLogin: settings.launchAtLogin,
      openAsHidden: true
    });
  }

  // Update server config defaultRootDir if specified
  if (settings.sharedFolder) {
    const cfg = loadConfig();
    cfg.defaultRootDir = settings.sharedFolder;
    saveConfig(cfg);
  }

  return settings;
});

ipcMain.handle('logs:get', () => serverController.logs);
ipcMain.handle('logs:clear', () => {
  serverController.clearLogs();
  return true;
});

// Event forwarding from serverController to renderer & tray
serverController.on('status', (status) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-status-changed', status);
  }
  updateTrayMenu();
});

serverController.on('log', (logEntry) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-log', logEntry);
  }
});

// Application Lifecycle
app.whenReady().then(async () => {
  setupAppMenu();
  createTray();
  createMainWindow();

  const settings = loadDesktopSettings();

  // Auto-start server automatically on app launch
  if (settings.autoStartOnLaunch !== false) {
    try {
      await serverController.start({
        port: settings.port || 7890,
        autoTunnel: settings.autoTunnel !== false
      });
    } catch (err) {
      console.error('Failed to auto-start server:', err);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', async () => {
  isQuitting = true;
  try {
    await serverController.stop();
  } catch (e) {}
});

app.on('window-all-closed', () => {
  // On macOS, apps stay active in Dock or Menu Bar until Cmd+Q
  const settings = loadDesktopSettings();
  if (!settings.minimizeToTray && process.platform !== 'darwin') {
    app.quit();
  }
});
