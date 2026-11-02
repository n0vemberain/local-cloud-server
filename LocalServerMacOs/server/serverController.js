import http from 'http';
import { EventEmitter } from 'events';
import QRCode from 'qrcode';
import { createApp } from './app.js';
import { loadConfig, saveConfig } from './config.js';
import { getLocalIpAddresses } from './systemInfo.js';
import { startTunnel, stopTunnel } from './tunnelManager.js';

class ServerController extends EventEmitter {
  constructor() {
    super();
    this.httpServer = null;
    this.status = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'
    this.port = 7890;
    this.localIps = [];
    this.primaryIp = '127.0.0.1';
    this.localUrl = '';
    this.loopbackUrl = '';
    this.localQr = '';
    this.tunnelInfo = {
      running: false,
      url: null,
      status: 'stopped',
      error: null,
      qr: ''
    };
    this.startedAt = null;
    this.logs = [];
    this.maxLogs = 300;
  }

  log(level, message) {
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      time: new Date().toLocaleTimeString(),
      level, // 'info' | 'warn' | 'error' | 'tunnel' | 'network'
      message: typeof message === 'string' ? message : JSON.stringify(message)
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.emit('log', entry);
  }

  async start(options = {}) {
    if (this.status === 'running' || this.status === 'starting') {
      return this.getStatus();
    }

    this.status = 'starting';
    this.emit('status', this.getStatus());
    this.log('info', 'Initializing Personal Cloud Server on macOS...');

    const cfg = loadConfig();
    this.port = options.port || cfg.port || 7890;
    const shouldStartTunnel = options.autoTunnel !== undefined ? options.autoTunnel : cfg.autoTunnel;

    try {
      const app = createApp();
      this.httpServer = http.createServer(app);

      await new Promise((resolve, reject) => {
        this.httpServer.once('error', (err) => {
          this.status = 'error';
          this.log('error', `Server startup error: ${err.message}`);
          this.emit('status', this.getStatus());
          reject(err);
        });

        this.httpServer.listen(this.port, '0.0.0.0', () => {
          resolve();
        });
      });

      this.status = 'running';
      this.startedAt = new Date();

      // Detect Wi-Fi / Local IPs
      this.refreshNetworkInfo();

      this.log('network', `Server listening on Local Wi-Fi: ${this.localUrl}`);
      this.log('network', `Loopback URL: ${this.loopbackUrl}`);

      // Generate Local Wi-Fi QR Code
      try {
        this.localQr = await QRCode.toDataURL(this.localUrl, {
          margin: 2,
          width: 256,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
      } catch (err) {
        this.log('warn', `Failed to generate local QR code: ${err.message}`);
      }

      this.emit('status', this.getStatus());

      // Start Cloudflare Tunnel for Remote Worldwide Access if requested
      if (shouldStartTunnel) {
        this.startTunnelProcess();
      }

      return this.getStatus();
    } catch (err) {
      this.status = 'error';
      this.emit('status', this.getStatus());
      throw err;
    }
  }

  refreshNetworkInfo() {
    this.localIps = getLocalIpAddresses();
    this.primaryIp = this.localIps[0]?.address || '127.0.0.1';
    this.localUrl = `http://${this.primaryIp}:${this.port}`;
    this.loopbackUrl = `http://localhost:${this.port}`;
  }

  async startTunnelProcess() {
    this.tunnelInfo = {
      running: false,
      url: null,
      status: 'starting',
      error: null,
      qr: ''
    };
    this.emit('status', this.getStatus());
    this.log('tunnel', 'Connecting Cloudflare secure encrypted tunnel for remote access...');

    try {
      const result = await startTunnel(this.port);
      if (result.running && result.url) {
        let qr = '';
        try {
          qr = await QRCode.toDataURL(result.url, {
            margin: 2,
            width: 256,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
        } catch (e) {}

        this.tunnelInfo = {
          running: true,
          url: result.url,
          status: 'online',
          error: null,
          qr
        };
        this.log('tunnel', `Remote Internet Access established: ${result.url}`);
      } else {
        this.tunnelInfo = {
          running: false,
          url: null,
          status: result.status || 'error',
          error: result.error || 'Could not establish tunnel',
          qr: ''
        };
        this.log('warn', `Tunnel status: ${result.status} - ${result.error || ''}`);
      }
    } catch (err) {
      this.tunnelInfo = {
        running: false,
        url: null,
        status: 'error',
        error: err.message,
        qr: ''
      };
      this.log('error', `Failed to initialize tunnel: ${err.message}`);
    }

    this.emit('status', this.getStatus());
  }

  async stopTunnelProcess() {
    this.log('tunnel', 'Stopping remote access tunnel...');
    try {
      await stopTunnel();
    } catch (e) {}
    this.tunnelInfo = {
      running: false,
      url: null,
      status: 'stopped',
      error: null,
      qr: ''
    };
    this.emit('status', this.getStatus());
  }

  async toggleTunnel(enable) {
    if (enable) {
      await this.startTunnelProcess();
    } else {
      await this.stopTunnelProcess();
    }
    return this.getStatus();
  }

  async stop() {
    if (this.status === 'stopped') {
      return this.getStatus();
    }

    this.log('info', 'Stopping server...');
    await this.stopTunnelProcess();

    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(() => {
          resolve();
        });
      });
      this.httpServer = null;
    }

    this.status = 'stopped';
    this.startedAt = null;
    this.log('info', 'Personal Cloud Server stopped.');
    this.emit('status', this.getStatus());
    return this.getStatus();
  }

  async restart() {
    this.log('info', 'Restarting server...');
    await this.stop();
    await new Promise((r) => setTimeout(r, 400));
    return this.start();
  }

  clearLogs() {
    this.logs = [];
    this.emit('logs-cleared');
  }

  getStatus() {
    const cfg = loadConfig();
    return {
      status: this.status,
      port: this.port,
      primaryIp: this.primaryIp,
      localIps: this.localIps,
      localUrl: this.localUrl,
      loopbackUrl: this.loopbackUrl,
      localQr: this.localQr,
      tunnel: this.tunnelInfo,
      serverName: cfg.serverName || 'MacBook Local Server',
      isConfigured: !!cfg.isConfigured,
      defaultRootDir: cfg.defaultRootDir,
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      uptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0
    };
  }
}

export const serverController = new ServerController();
