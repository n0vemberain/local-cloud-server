// DOM Elements
const elements = {
  // App Container & Sidebar
  appContainer: document.getElementById('app-container'),
  sidebar: document.getElementById('sidebar'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  btnCollapseSidebar: document.getElementById('btn-collapse-sidebar'),
  btnExpandSidebarFloating: document.getElementById('btn-expand-sidebar-floating'),

  // Navigation
  navItems: document.querySelectorAll('.nav-item'),
  tabPages: document.querySelectorAll('.tab-page'),
  logCountBadge: document.getElementById('log-count-badge'),

  // Titlebar
  titlebarBadge: document.getElementById('titlebar-badge'),
  btnQuickBrowser: document.getElementById('btn-quick-open-browser'),
  btnQuickFinder: document.getElementById('btn-quick-finder'),

  // Footer status
  footerDot: document.getElementById('footer-status-dot'),
  footerTitle: document.getElementById('footer-status-title'),
  footerUptime: document.getElementById('footer-uptime'),

  // Hero
  heroPulse: document.getElementById('hero-pulse'),
  heroStatusTitle: document.getElementById('hero-status-title'),
  heroStatusSub: document.getElementById('hero-status-sub'),
  btnToggleServer: document.getElementById('btn-toggle-server'),
  btnToggleIcon: document.getElementById('btn-toggle-icon'),
  btnToggleLabel: document.getElementById('btn-toggle-label'),
  btnRestartServer: document.getElementById('btn-restart-server'),

  // Wi-Fi Card
  wifiBadge: document.getElementById('wifi-badge'),
  inputLocalUrl: document.getElementById('input-local-url'),
  btnCopyLocal: document.getElementById('btn-copy-local'),
  btnOpenLocal: document.getElementById('btn-open-local'),
  inputLoopbackUrl: document.getElementById('input-loopback-url'),
  btnCopyLoopback: document.getElementById('btn-copy-loopback'),
  qrLocalImg: document.getElementById('qr-local-img'),
  qrLocalPlaceholder: document.getElementById('qr-local-placeholder'),

  // Remote Card
  remoteBadge: document.getElementById('remote-badge'),
  toggleTunnel: document.getElementById('toggle-tunnel'),
  inputRemoteUrl: document.getElementById('input-remote-url'),
  btnCopyRemote: document.getElementById('btn-copy-remote'),
  btnOpenRemote: document.getElementById('btn-open-remote'),
  qrRemoteImg: document.getElementById('qr-remote-img'),
  qrRemotePlaceholder: document.getElementById('qr-remote-placeholder'),

  // Specs & Credentials
  specPort: document.getElementById('spec-port'),
  specFolder: document.getElementById('spec-folder'),
  btnLaunchWebView: document.getElementById('btn-launch-web-view'),

  // Embedded Webview
  cloudIframe: document.getElementById('cloud-iframe'),
  webviewUrlDisplay: document.getElementById('webview-url-display'),
  btnWebviewReload: document.getElementById('btn-webview-reload'),
  btnWebviewExternal: document.getElementById('btn-webview-external'),

  // Logs
  terminalContainer: document.getElementById('terminal-container'),
  logFilterBtns: document.querySelectorAll('.log-filter-btn'),
  checkboxAutoscroll: document.getElementById('checkbox-autoscroll'),
  btnClearLogs: document.getElementById('btn-clear-logs'),

  // Settings
  settingAutoStart: document.getElementById('setting-auto-start'),
  settingAutoTunnel: document.getElementById('setting-auto-tunnel'),
  settingLaunchLogin: document.getElementById('setting-launch-login'),
  settingMinimizeTray: document.getElementById('setting-minimize-tray'),
  settingPort: document.getElementById('setting-port'),
  settingFolder: document.getElementById('setting-folder'),
  btnBrowseFolder: document.getElementById('btn-browse-folder'),
  btnSaveSettings: document.getElementById('btn-save-settings'),

  // Toast
  toastContainer: document.getElementById('toast-container')
};

let currentStatus = null;
let currentFilter = 'all';
let allLogs = [];
let uptimeInterval = null;

// Sidebar Collapse / Expand
function setSidebarCollapsed(collapsed) {
  elements.appContainer.classList.toggle('sidebar-collapsed', collapsed);
  elements.btnToggleSidebar.classList.toggle('active', !collapsed);
  try {
    localStorage.setItem('sidebar_collapsed', collapsed ? 'true' : 'false');
  } catch (e) {}
}

function toggleSidebar() {
  const isCurrentlyCollapsed = elements.appContainer.classList.contains('sidebar-collapsed');
  setSidebarCollapsed(!isCurrentlyCollapsed);
}

// Show Toast
function showToast(message, duration = 2500) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Format Seconds to HH:MM:SS
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// Start Uptime Timer
function startUptimeTicker() {
  if (uptimeInterval) clearInterval(uptimeInterval);
  uptimeInterval = setInterval(() => {
    if (currentStatus && currentStatus.status === 'running' && currentStatus.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(currentStatus.startedAt).getTime()) / 1000);
      elements.footerUptime.textContent = `Uptime: ${formatUptime(elapsed)}`;
    } else {
      elements.footerUptime.textContent = 'Uptime: 00:00:00';
    }
  }, 1000);
}

// Render Server Status
function renderStatus(status) {
  currentStatus = status;
  const isRunning = status.status === 'running';
  const isStarting = status.status === 'starting';

  // Titlebar & Badges
  if (isRunning) {
    elements.titlebarBadge.className = 'badge badge-success';
    elements.titlebarBadge.textContent = 'Active';
    elements.footerDot.className = 'status-dot-pulse';
    elements.footerTitle.textContent = `Running (Port ${status.port})`;
    elements.heroPulse.className = 'pulse-indicator';
    elements.heroStatusTitle.textContent = 'Server Active & Listening';
    elements.heroStatusSub.textContent = `Connected to your local network. Devices on your Wi-Fi or across the internet can access your MacBook server files.`;

    elements.btnToggleIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>`;
    elements.btnToggleLabel.textContent = 'Stop Server';
    elements.btnToggleServer.className = 'btn btn-secondary';
  } else if (isStarting) {
    elements.titlebarBadge.className = 'badge badge-starting';
    elements.titlebarBadge.textContent = 'Starting...';
    elements.footerDot.className = 'status-dot-pulse starting';
    elements.footerTitle.textContent = 'Starting Server...';
    elements.heroPulse.className = 'pulse-indicator starting';
    elements.heroStatusTitle.textContent = 'Starting Local Server...';
    elements.heroStatusSub.textContent = 'Binding to local Wi-Fi and initializing personal cloud services...';

    elements.btnToggleIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
    elements.btnToggleLabel.textContent = 'Starting...';
    elements.btnToggleServer.className = 'btn btn-secondary';
  } else {
    elements.titlebarBadge.className = 'badge badge-error';
    elements.titlebarBadge.textContent = 'Stopped';
    elements.footerDot.className = 'status-dot-pulse stopped';
    elements.footerTitle.textContent = 'Server Stopped';
    elements.heroPulse.className = 'pulse-indicator stopped';
    elements.heroStatusTitle.textContent = 'Server is Stopped';
    elements.heroStatusSub.textContent = 'Click "Start Server" to activate your local cloud and allow devices to connect.';

    elements.btnToggleIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    elements.btnToggleLabel.textContent = 'Start Server';
    elements.btnToggleServer.className = 'btn btn-primary';
  }

  // Local Wi-Fi Card
  if (isRunning && status.localUrl) {
    elements.inputLocalUrl.value = status.localUrl;
    elements.inputLoopbackUrl.value = status.loopbackUrl;
    elements.wifiBadge.className = 'badge badge-success';
    elements.wifiBadge.textContent = 'Wi-Fi Active';

    if (status.localQr) {
      elements.qrLocalImg.src = status.localQr;
      elements.qrLocalImg.classList.add('visible');
      elements.qrLocalPlaceholder.style.display = 'none';
    }
  } else {
    elements.inputLocalUrl.value = 'Server stopped';
    elements.inputLoopbackUrl.value = 'http://localhost:' + (status.port || 7890);
    elements.wifiBadge.className = 'badge badge-error';
    elements.wifiBadge.textContent = 'Inactive';
    elements.qrLocalImg.classList.remove('visible');
    elements.qrLocalPlaceholder.style.display = 'block';
    elements.qrLocalPlaceholder.textContent = 'Server Stopped';
  }

  // Remote Internet Card
  const tunnel = status.tunnel || {};
  elements.toggleTunnel.checked = tunnel.status !== 'stopped';

  if (tunnel.status === 'online' && tunnel.url) {
    elements.remoteBadge.className = 'badge badge-success';
    elements.remoteBadge.textContent = 'Tunnel Online';
    elements.inputRemoteUrl.value = tunnel.url;

    if (tunnel.qr) {
      elements.qrRemoteImg.src = tunnel.qr;
      elements.qrRemoteImg.classList.add('visible');
      elements.qrRemotePlaceholder.style.display = 'none';
    }
  } else if (tunnel.status === 'starting') {
    elements.remoteBadge.className = 'badge badge-warning';
    elements.remoteBadge.textContent = 'Connecting...';
    elements.inputRemoteUrl.value = 'Establishing secure Cloudflare tunnel...';
    elements.qrRemoteImg.classList.remove('visible');
    elements.qrRemotePlaceholder.style.display = 'block';
    elements.qrRemotePlaceholder.textContent = 'Connecting...';
  } else if (tunnel.status === 'error') {
    elements.remoteBadge.className = 'badge badge-error';
    elements.remoteBadge.textContent = 'Error';
    elements.inputRemoteUrl.value = tunnel.error || 'Tunnel connection failed';
    elements.qrRemoteImg.classList.remove('visible');
    elements.qrRemotePlaceholder.style.display = 'block';
    elements.qrRemotePlaceholder.textContent = 'Tunnel Error';
  } else {
    elements.remoteBadge.className = 'badge badge-error';
    elements.remoteBadge.textContent = 'Disabled';
    elements.inputRemoteUrl.value = 'Remote access disabled';
    elements.qrRemoteImg.classList.remove('visible');
    elements.qrRemotePlaceholder.style.display = 'block';
    elements.qrRemotePlaceholder.textContent = 'Tunnel Disabled';
  }

  // Specs & Credentials
  elements.specPort.textContent = status.port || 7890;
  elements.specFolder.textContent = status.defaultRootDir || '~';

  // Synchronize Webview URL if running
  if (isRunning) {
    const targetUrl = status.loopbackUrl || `http://localhost:${status.port}`;
    elements.webviewUrlDisplay.textContent = targetUrl;
    if (elements.cloudIframe.src === 'about:blank' || !elements.cloudIframe.src) {
      elements.cloudIframe.src = targetUrl;
    }
  }
}

// Append Log Entry
function appendLog(entry) {
  allLogs.push(entry);
  if (allLogs.length > 500) allLogs.shift();

  elements.logCountBadge.textContent = allLogs.length;

  if (currentFilter !== 'all' && entry.level !== currentFilter) {
    return;
  }

  const line = document.createElement('div');
  line.className = 'log-line';

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = entry.time || new Date().toLocaleTimeString();

  const tag = document.createElement('span');
  tag.className = `log-tag tag-${entry.level || 'info'}`;
  tag.textContent = entry.level || 'INFO';

  const msg = document.createElement('span');
  msg.className = 'log-msg';
  msg.textContent = entry.message;

  line.appendChild(time);
  line.appendChild(tag);
  line.appendChild(msg);

  elements.terminalContainer.appendChild(line);

  if (elements.checkboxAutoscroll.checked) {
    elements.terminalContainer.scrollTop = elements.terminalContainer.scrollHeight;
  }
}

function renderLogsFiltered() {
  elements.terminalContainer.innerHTML = '';
  const filtered = currentFilter === 'all' ? allLogs : allLogs.filter((l) => l.level === currentFilter);
  for (const entry of filtered) {
    const line = document.createElement('div');
    line.className = 'log-line';

    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = entry.time || '';

    const tag = document.createElement('span');
    tag.className = `log-tag tag-${entry.level || 'info'}`;
    tag.textContent = entry.level || 'INFO';

    const msg = document.createElement('span');
    msg.className = 'log-msg';
    msg.textContent = entry.message;

    line.appendChild(time);
    line.appendChild(tag);
    line.appendChild(msg);

    elements.terminalContainer.appendChild(line);
  }

  if (elements.checkboxAutoscroll.checked) {
    elements.terminalContainer.scrollTop = elements.terminalContainer.scrollHeight;
  }
}

// Switch Tabs
function switchTab(targetTab) {
  elements.navItems.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === targetTab);
  });
  elements.tabPages.forEach((page) => {
    page.classList.toggle('active', page.id === `tab-${targetTab}`);
  });

  if (targetTab === 'webview' && currentStatus && currentStatus.status === 'running') {
    const targetUrl = currentStatus.loopbackUrl || `http://localhost:${currentStatus.port}`;
    if (elements.cloudIframe.src === 'about:blank' || !elements.cloudIframe.src) {
      elements.cloudIframe.src = targetUrl;
    }
  }
}

// Event Listeners
function setupEvents() {
  // Sidebar Toggle Handlers
  if (elements.btnToggleSidebar) {
    elements.btnToggleSidebar.addEventListener('click', toggleSidebar);
  }
  if (elements.btnCollapseSidebar) {
    elements.btnCollapseSidebar.addEventListener('click', () => setSidebarCollapsed(true));
  }
  if (elements.btnExpandSidebarFloating) {
    elements.btnExpandSidebarFloating.addEventListener('click', () => setSidebarCollapsed(false));
  }

  // Navigation
  elements.navItems.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Server Toggle
  elements.btnToggleServer.addEventListener('click', async () => {
    if (!currentStatus) return;
    try {
      if (currentStatus.status === 'running') {
        showToast('Stopping server...');
        await window.electronAPI.stopServer();
      } else {
        showToast('Starting server...');
        await window.electronAPI.startServer();
      }
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  });

  // Server Restart
  elements.btnRestartServer.addEventListener('click', async () => {
    try {
      showToast('Restarting server and tunnels...');
      await window.electronAPI.restartServer();
      showToast('Server restarted successfully!');
    } catch (err) {
      showToast('Restart error: ' + err.message);
    }
  });

  // Tunnel Toggle Switch
  elements.toggleTunnel.addEventListener('change', async (e) => {
    const enable = e.target.checked;
    try {
      showToast(enable ? 'Connecting Cloudflare tunnel...' : 'Disconnecting tunnel...');
      await window.electronAPI.toggleTunnel(enable);
    } catch (err) {
      showToast('Tunnel error: ' + err.message);
    }
  });

  // Copy Buttons
  elements.btnCopyLocal.addEventListener('click', async () => {
    if (currentStatus?.localUrl) {
      await window.electronAPI.copyToClipboard(currentStatus.localUrl);
      showToast('Copied Local Wi-Fi URL: ' + currentStatus.localUrl);
    }
  });

  elements.btnCopyLoopback.addEventListener('click', async () => {
    const url = elements.inputLoopbackUrl.value;
    if (url) {
      await window.electronAPI.copyToClipboard(url);
      showToast('Copied Loopback URL: ' + url);
    }
  });

  elements.btnCopyRemote.addEventListener('click', async () => {
    const url = currentStatus?.tunnel?.url;
    if (url) {
      await window.electronAPI.copyToClipboard(url);
      showToast('Copied Remote Public URL: ' + url);
    } else {
      showToast('Remote tunnel is not active yet.');
    }
  });

  // Open in Browser Buttons
  elements.btnOpenLocal.addEventListener('click', () => {
    const url = currentStatus?.localUrl || currentStatus?.loopbackUrl;
    if (url) window.electronAPI.openInBrowser(url);
  });

  elements.btnOpenRemote.addEventListener('click', () => {
    const url = currentStatus?.tunnel?.url;
    if (url) window.electronAPI.openInBrowser(url);
    else showToast('Remote URL is not available.');
  });

  elements.btnQuickBrowser.addEventListener('click', () => {
    const url = currentStatus?.localUrl || currentStatus?.loopbackUrl;
    if (url) window.electronAPI.openInBrowser(url);
  });

  elements.btnQuickFinder.addEventListener('click', () => {
    window.electronAPI.openFolder(currentStatus?.defaultRootDir);
  });

  elements.btnLaunchWebView.addEventListener('click', () => {
    switchTab('webview');
  });

  // Embedded Webview Toolbar
  elements.btnWebviewReload.addEventListener('click', () => {
    elements.cloudIframe.src = elements.cloudIframe.src;
  });

  elements.btnWebviewExternal.addEventListener('click', () => {
    const url = currentStatus?.localUrl || currentStatus?.loopbackUrl;
    if (url) window.electronAPI.openInBrowser(url);
  });

  // Logs Filter & Clear
  elements.logFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      elements.logFilterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderLogsFiltered();
    });
  });

  elements.btnClearLogs.addEventListener('click', async () => {
    await window.electronAPI.clearLogs();
    allLogs = [];
    elements.terminalContainer.innerHTML = '';
    elements.logCountBadge.textContent = '0';
    showToast('Logs cleared.');
  });

  // Settings
  elements.btnBrowseFolder.addEventListener('click', async () => {
    const dir = await window.electronAPI.selectFolder();
    if (dir) {
      elements.settingFolder.value = dir;
    }
  });

  elements.btnSaveSettings.addEventListener('click', async () => {
    const newSettings = {
      autoStartOnLaunch: elements.settingAutoStart.checked,
      autoTunnel: elements.settingAutoTunnel.checked,
      launchAtLogin: elements.settingLaunchLogin.checked,
      minimizeToTray: elements.settingMinimizeTray.checked,
      port: parseInt(elements.settingPort.value, 10) || 7890,
      sharedFolder: elements.settingFolder.value
    };

    await window.electronAPI.saveSettings(newSettings);
    showToast('Settings saved successfully!');

    // Restart server if port changed
    if (currentStatus && currentStatus.port !== newSettings.port) {
      showToast('Restarting server on new port ' + newSettings.port + '...');
      await window.electronAPI.restartServer();
    }
  });
}

// Initialize Application
async function init() {
  setupEvents();
  startUptimeTicker();

  // Restore Sidebar Collapsed Preference
  try {
    const savedCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (savedCollapsed) {
      setSidebarCollapsed(true);
    }
  } catch (e) {}

  // Load Initial Settings
  try {
    const settings = await window.electronAPI.getSettings();
    elements.settingAutoStart.checked = settings.autoStartOnLaunch !== false;
    elements.settingAutoTunnel.checked = settings.autoTunnel !== false;
    elements.settingLaunchLogin.checked = !!settings.launchAtLogin;
    elements.settingMinimizeTray.checked = settings.minimizeToTray !== false;
    elements.settingPort.value = settings.port || 7890;
    elements.settingFolder.value = settings.sharedFolder || '';
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Load Status
  try {
    const status = await window.electronAPI.getServerStatus();
    renderStatus(status);
  } catch (err) {
    console.error('Failed to fetch status:', err);
  }

  // Load Logs
  try {
    const logs = await window.electronAPI.getLogs();
    if (Array.isArray(logs)) {
      for (const log of logs) {
        appendLog(log);
      }
    }
  } catch (e) {}

  // Subscribe to real-time events
  window.electronAPI.onStatusChange((newStatus) => {
    renderStatus(newStatus);
  });

  window.electronAPI.onLog((entry) => {
    appendLog(entry);
  });
}

window.addEventListener('DOMContentLoaded', init);
