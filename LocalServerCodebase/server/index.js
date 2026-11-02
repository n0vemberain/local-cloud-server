import http from 'http';
import QRCode from 'qrcode';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { getLocalIpAddresses } from './systemInfo.js';
import { startTunnel } from './tunnelManager.js';

async function main() {
  const cfg = loadConfig();
  const app = createApp();
  const server = http.createServer(app);

  server.listen(cfg.port, cfg.host, async () => {
    const localIps = getLocalIpAddresses();
    const primaryIp = localIps[0]?.address || '127.0.0.1';
    const localUrl = `http://${primaryIp}:${cfg.port}`;
    const loopbackUrl = `http://localhost:${cfg.port}`;

    console.clear();
    console.log('\x1b[36m%s\x1b[0m', '===============================================================');
    console.log('\x1b[1m\x1b[32m%s\x1b[0m', `  Personal Cloud Server — Running Successfully`);
    console.log('\x1b[36m%s\x1b[0m', '===============================================================');
    console.log(`\n\x1b[1m[1] Local Network Access (Same Wi-Fi / LAN):\x1b[0m`);
    console.log(`    Local URL: \x1b[34m\x1b[4m${localUrl}\x1b[0m`);
    console.log(`    Loopback:  \x1b[90m${loopbackUrl}\x1b[0m (Directly on this machine)`);

    if (localIps.length > 1) {
      console.log(`    Other Local IPs:`);
      localIps.slice(1).forEach(ip => {
        console.log(`    - http://${ip.address}:${cfg.port} (${ip.interface})`);
      });
    }

    console.log(`\n\x1b[1m[Authentication] Administrator Credentials:\x1b[0m`);
    console.log(`    Username: \x1b[33m\x1b[1madmin\x1b[0m`);
    if (cfg.isConfigured) {
      console.log(`    Password: \x1b[33m[User Configured]\x1b[0m`);
    } else {
      console.log(`    Password: \x1b[33m\x1b[1mmac1234\x1b[0m  \x1b[90m(Change anytime from settings after login)\x1b[0m`);
    }

    // Generate local QR code for mobile
    try {
      const qrAscii = await QRCode.toString(localUrl, { type: 'terminal', small: true });
      console.log(`\n\x1b[1mScan with mobile camera to connect via local Wi-Fi:\x1b[0m`);
      console.log(qrAscii);
    } catch (e) {
      // ignore
    }

    // Start Cloudflare Tunnel for Remote Access (Any Network in the world)
    if (cfg.autoTunnel) {
      console.log('\x1b[36m%s\x1b[0m', '---------------------------------------------------------------');
      console.log(`\x1b[1m[2] Remote Internet Access (Any Network / 4G / 5G):\x1b[0m`);
      console.log(`    Establishing secure encrypted tunnel...`);

      try {
        const tunnel = await startTunnel(cfg.port);
        if (tunnel.running && tunnel.url) {
          console.log(`    Public URL: \x1b[1m\x1b[35m\x1b[4m${tunnel.url}\x1b[0m`);
          console.log(`    \x1b[90m(Accessible from anywhere in the world without port forwarding)\x1b[0m\n`);
          try {
            const qrTunnel = await QRCode.toString(tunnel.url, { type: 'terminal', small: true });
            console.log(`    Remote Access QR Code:`);
            console.log(qrTunnel);
          } catch (err) {}
        } else {
          console.log(`    Tunnel Status: ${tunnel.error || 'Connecting in background...'}`);
        }
      } catch (err) {
        console.log(`    Tunnel Error: ${err.message}`);
      }
    }

    console.log('\x1b[36m%s\x1b[0m', '===============================================================');
    console.log(`Press Ctrl + C to stop the server.\n`);
  });
}

main().catch(err => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
