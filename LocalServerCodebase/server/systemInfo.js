import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      // IPv4, non-internal
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          address: net.address
        });
      }
    }
  }

  // Prioritize Wi-Fi and primary LAN adapters across macOS, Windows, Linux
  addresses.sort((a, b) => {
    const isPrimaryA = a.interface === 'en0' || /wi-fi|wlan|wireless/i.test(a.interface);
    const isPrimaryB = b.interface === 'en0' || /wi-fi|wlan|wireless/i.test(b.interface);
    if (isPrimaryA && !isPrimaryB) return -1;
    if (!isPrimaryA && isPrimaryB) return 1;
    return a.interface.localeCompare(b.interface);
  });

  return addresses;
}

export async function getMacMetrics() {
  const localIps = getLocalIpAddresses();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  let battery = { percent: null, status: 'Unknown', isCharging: false };
  let disk = { total: '0 GB', used: '0 GB', free: '0 GB', percentUsed: 0 };

  const isWin = process.platform === 'win32';

  // Fetch battery details
  if (isWin) {
    try {
      const { stdout } = await execPromise('powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_Battery).EstimatedChargeRemaining"');
      const val = parseInt(stdout.trim(), 10);
      if (!isNaN(val)) {
        battery.percent = val;
        battery.status = 'Battery / AC';
        battery.isCharging = true;
      }
    } catch (e) {}
  } else {
    // macOS / Linux
    try {
      const { stdout } = await execPromise('pmset -g batt');
      const percentMatch = stdout.match(/(\d+)%/);
      if (percentMatch) {
        battery.percent = parseInt(percentMatch[1], 10);
        const isCharging = stdout.includes('charging') && !stdout.includes('discharging');
        const isAc = stdout.includes('AC Power') || stdout.includes('AC attached');
        battery.isCharging = isCharging || isAc;
        battery.status = stdout.includes('discharging') ? 'Discharging' : (isCharging ? 'Charging' : 'Full / AC');
      }
    } catch (err) {}
  }

  // Fetch disk usage using cross-platform statfs
  try {
    const rootPath = isWin ? (process.env.SystemDrive || 'C:') + '\\' : '/';
    const stat = await fs.promises.statfs(rootPath);
    const totalBytes = Number(stat.bsize) * Number(stat.blocks);
    const freeBytes = Number(stat.bsize) * Number(stat.bfree);
    const usedBytes = totalBytes - freeBytes;

    const totalGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
    const usedGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(1);
    const freeGb = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
    const pct = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

    disk = {
      total: `${totalGb} GB`,
      used: `${usedGb} GB`,
      free: `${freeGb} GB`,
      percentUsed: pct
    };
  } catch (err) {
    // Fallback if statfs fails
  }

  return {
    hostname: os.hostname(),
    model: os.cpus()[0]?.model || 'Apple Silicon / Intel',
    cpuCores: os.cpus().length,
    uptimeSeconds: os.uptime(),
    memory: {
      total: `${(totalMem / (1024 * 1024 * 1024)).toFixed(1)} GB`,
      used: `${(usedMem / (1024 * 1024 * 1024)).toFixed(1)} GB`,
      free: `${(freeMem / (1024 * 1024 * 1024)).toFixed(1)} GB`,
      percentUsed: Math.round((usedMem / totalMem) * 100)
    },
    battery,
    disk,
    network: localIps
  };
}
