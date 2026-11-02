import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  getServerStatus: () => ipcRenderer.invoke('server:get-status'),
  startServer: (opts) => ipcRenderer.invoke('server:start', opts),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  restartServer: () => ipcRenderer.invoke('server:restart'),
  toggleTunnel: (enable) => ipcRenderer.invoke('tunnel:toggle', enable),

  openInBrowser: (url) => ipcRenderer.invoke('shell:open-browser', url),
  openFolder: (dirPath) => ipcRenderer.invoke('shell:open-folder', dirPath),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  getLogs: () => ipcRenderer.invoke('logs:get'),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),

  onStatusChange: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('server-status-changed', handler);
    return () => ipcRenderer.removeListener('server-status-changed', handler);
  },

  onLog: (callback) => {
    const handler = (_event, logEntry) => callback(logEntry);
    ipcRenderer.on('server-log', handler);
    return () => ipcRenderer.removeListener('server-log', handler);
  }
});
