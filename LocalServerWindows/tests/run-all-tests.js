import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Set test environment variables
const testDataDir = path.join(os.tmpdir(), 'local-server-win-test-' + Date.now());
fs.mkdirSync(testDataDir, { recursive: true });
process.env.LOCAL_SERVER_DATA_DIR = testDataDir;
process.env.LOCAL_SERVER_PUBLIC_DIR = path.join(rootDir, 'public');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    testResults.push({ name: message, status: 'PASSED' });
    console.log(`  \x1b[32m✔\x1b[0m ${message}`);
  } else {
    failedTests++;
    testResults.push({ name: message, status: 'FAILED' });
    console.error(`  \x1b[31m✖\x1b[0m ${message}`);
  }
}

async function runTests() {
  console.log('\n\x1b[1m\x1b[36m=== Local Cloud Server Windows Test Suite ===\x1b[0m\n');

  // Test Suite 1: File & Assets Verification
  console.log('\x1b[1m[Suite 1] Windows File & Asset Integrity Checks\x1b[0m');
  assert(fs.existsSync(path.join(rootDir, 'main.js')), 'main.js Electron entry point exists');
  assert(fs.existsSync(path.join(rootDir, 'preload.js')), 'preload.js context bridge exists');
  assert(fs.existsSync(path.join(rootDir, 'renderer', 'index.html')), 'renderer/index.html UI exists');
  assert(fs.existsSync(path.join(rootDir, 'renderer', 'styles.css')), 'renderer/styles.css exists');
  assert(fs.existsSync(path.join(rootDir, 'renderer', 'app.js')), 'renderer/app.js exists');
  assert(fs.existsSync(path.join(rootDir, 'public', 'index.html')), 'public/index.html web dashboard exists');
  assert(fs.existsSync(path.join(rootDir, 'build', 'icon.ico')), 'build/icon.ico Windows icon exists');
  assert(fs.existsSync(path.join(rootDir, 'assets', 'tray.png')), 'assets/tray.png Windows tray icon exists');

  const icoStats = fs.statSync(path.join(rootDir, 'build', 'icon.ico'));
  assert(icoStats.size > 10000, `icon.ico has valid multi-resolution size (${icoStats.size} bytes)`);

  const binPath = path.join(rootDir, 'bin', 'cloudflared.exe');
  assert(fs.existsSync(binPath), 'cloudflared.exe Windows binary exists in bin/');
  const binStats = fs.statSync(binPath);
  assert(binStats.size > 20000000, `cloudflared.exe has valid binary size (${(binStats.size / (1024*1024)).toFixed(1)} MB)`);

  // Test Suite 2: Paths & Config Module
  console.log('\n\x1b[1m[Suite 2] Windows Paths & Configuration\x1b[0m');
  const { getDataDir, getPublicDir, getCloudflaredBin, getFfmpegBin } = await import('../server/paths.js');
  assert(getDataDir() === testDataDir, `getDataDir respects LOCAL_SERVER_DATA_DIR: ${getDataDir()}`);
  assert(fs.existsSync(getPublicDir()), `getPublicDir resolves valid path: ${getPublicDir()}`);
  assert(fs.existsSync(getCloudflaredBin()), `getCloudflaredBin resolves existing binary: ${getCloudflaredBin()}`);

  const ffmpegBin = getFfmpegBin();
  assert(ffmpegBin && fs.existsSync(ffmpegBin), `getFfmpegBin resolves executable binary: ${ffmpegBin}`);

  const { loadConfig, verifyPassword } = await import('../server/config.js');
  const cfg = loadConfig();
  assert(cfg && typeof cfg === 'object', 'loadConfig() returns valid config object');
  assert(verifyPassword('win1234', cfg), 'Default master password verification succeeds for "win1234"');

  // Test Suite 3: Local IP & System Info
  console.log('\n\x1b[1m[Suite 3] Network Interface & IP Resolution\x1b[0m');
  const { getLocalIpAddresses, getSystemMetrics } = await import('../server/systemInfo.js');
  const ips = getLocalIpAddresses();
  assert(Array.isArray(ips) && ips.length > 0, `Detected active network interfaces (${ips.length} found)`);
  assert(ips[0].address && ips[0].interface, `Primary interface resolved: ${ips[0].address} (${ips[0].interface})`);

  const metrics = await getSystemMetrics();
  assert(metrics && metrics.hostname && metrics.memory, 'System metrics reported successfully');

  // Test Suite 4: Server Controller Lifecycle & HTTP API
  console.log('\n\x1b[1m[Suite 4] Server Controller Lifecycle & HTTP API\x1b[0m');
  const { serverController } = await import('../server/serverController.js');

  const testPort = 7896;
  let statusEmitted = false;
  serverController.once('status', (s) => {
    statusEmitted = true;
  });

  const startRes = await serverController.start({ port: testPort, autoTunnel: false });
  assert(startRes.status === 'running', 'serverController.start() successfully reports status "running"');
  assert(startRes.port === testPort, `serverController binds to port ${testPort}`);
  assert(statusEmitted, 'serverController emits real-time "status" event');
  assert(startRes.localQr && startRes.localQr.startsWith('data:image/png;base64,'), 'Local QR code generated as valid PNG Data URL');

  // Test HTTP GET /api/auth/status
  const httpGet = (urlPath) => {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}${urlPath}`, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ statusCode: res.statusCode, data, headers: res.headers }));
      }).on('error', reject);
    });
  };

  const authRes = await httpGet('/api/auth/status');
  assert(authRes.statusCode === 200, `GET /api/auth/status responded with 200 OK`);
  const authBody = JSON.parse(authRes.data);
  assert(authBody.authenticated === false, 'Auth endpoint reports authenticated: false for new guest session');

  // Test HTTP GET / (Web Dashboard)
  const homeRes = await httpGet('/');
  assert(homeRes.statusCode === 200, 'GET / serves web dashboard HTML');
  assert(homeRes.data.includes('Local Cloud Server') || homeRes.data.includes('Personal Cloud Server'), 'Dashboard contains valid application title');

  // Test Suite 5: Windows Package Configuration (NSIS & Portable)
  console.log('\n\x1b[1m[Suite 5] Windows Installer & Packaging Config\x1b[0m');
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  assert(pkg.build && pkg.build.win, 'package.json contains electron-builder "win" configuration');
  assert(pkg.build.win.icon === 'build/icon.ico', 'Windows icon correctly mapped to build/icon.ico');
  const targets = pkg.build.win.target.map(t => typeof t === 'string' ? t : t.target);
  assert(targets.includes('nsis'), 'Target includes NSIS installer (.exe)');
  assert(targets.includes('portable'), 'Target includes Portable executable (.exe)');
  assert(pkg.build.nsis && pkg.build.nsis.oneClick === false, 'NSIS custom installer directory choice enabled');

  // Stop server
  console.log('\n\x1b[1m[Suite 6] Clean Server Shutdown\x1b[0m');
  const stopRes = await serverController.stop();
  assert(stopRes.status === 'stopped', 'serverController.stop() successfully halts server');

  // Summary
  console.log('\n\x1b[1m========================================\x1b[0m');
  console.log(`\x1b[1mTotal Tests: ${totalTests} | Passed: \x1b[32m${passedTests}\x1b[0m | Failed: \x1b[31m${failedTests}\x1b[0m`);
  console.log('\x1b[1m========================================\x1b[0m\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
