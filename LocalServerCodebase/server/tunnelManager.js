import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

let tunnelProcess = null;
let tunnelUrl = null;
let tunnelStatus = 'stopped'; // 'stopped' | 'starting' | 'online' | 'error'
let tunnelError = null;

function getBinaryPath() {
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'cloudflared.exe' : 'cloudflared';
  const localBinary = path.join(process.cwd(), 'bin', binaryName);
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }
  return binaryName; // system installed
}

export function startTunnel(port) {
  if (tunnelProcess) {
    return Promise.resolve({ running: true, url: tunnelUrl, status: tunnelStatus });
  }

  return new Promise((resolve) => {
    tunnelStatus = 'starting';
    tunnelError = null;
    tunnelUrl = null;

    const bin = getBinaryPath();
    const args = ['tunnel', '--url', `http://127.0.0.1:${port}`];

    console.log(`[Tunnel] Launching Cloudflare Tunnel with binary: ${bin}`);

    try {
      tunnelProcess = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      console.error('[Tunnel] Failed to start tunnel process:', err);
      tunnelStatus = 'error';
      tunnelError = err.message;
      return resolve({ running: false, url: null, status: 'error', error: err.message });
    }

    let resolved = false;

    const onData = (data) => {
      const text = data.toString();
      // Match trycloudflare.com URL
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        tunnelUrl = match[0];
        tunnelStatus = 'online';
        console.log(`[Tunnel] Remote Internet URL: ${tunnelUrl}`);
        if (!resolved) {
          resolved = true;
          resolve({ running: true, url: tunnelUrl, status: 'online' });
        }
      }
    };

    tunnelProcess.stdout.on('data', onData);
    tunnelProcess.stderr.on('data', onData);

    tunnelProcess.on('error', (err) => {
      console.error('[Tunnel] Process error:', err);
      tunnelStatus = 'error';
      tunnelError = err.message;
      if (!resolved) {
        resolved = true;
        resolve({ running: false, url: null, status: 'error', error: err.message });
      }
    });

    tunnelProcess.on('close', (code) => {
      console.log(`[Tunnel] Process exited with code ${code}`);
      tunnelProcess = null;
      tunnelUrl = null;
      tunnelStatus = 'stopped';
      if (!resolved) {
        resolved = true;
        resolve({ running: false, url: null, status: 'stopped' });
      }
    });

    // Timeout fallback after 15 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          running: !!tunnelUrl,
          url: tunnelUrl,
          status: tunnelStatus,
          error: tunnelStatus === 'starting' ? 'Tunnel creation taking longer than usual' : tunnelError
        });
      }
    }, 15000);
  });
}

export function stopTunnel() {
  if (tunnelProcess) {
    try {
      tunnelProcess.kill('SIGTERM');
    } catch (err) {
      console.error('[Tunnel] Error terminating tunnel:', err);
    }
    tunnelProcess = null;
  }
  tunnelUrl = null;
  tunnelStatus = 'stopped';
  tunnelError = null;
  return { running: false, status: 'stopped' };
}

export function getTunnelStatus() {
  return {
    running: tunnelStatus === 'online',
    status: tunnelStatus,
    url: tunnelUrl,
    error: tunnelError
  };
}

// Clean up on exit
process.on('SIGINT', () => {
  stopTunnel();
  process.exit();
});

process.on('SIGTERM', () => {
  stopTunnel();
  process.exit();
});
