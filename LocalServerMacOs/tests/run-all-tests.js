import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Set test environment variables
const testDataDir = path.join(os.tmpdir(), 'local-server-test-' + Date.now());
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
  console.log('\n\x1b[1m\x1b[36m=== Local Cloud Server macOS Test Suite ===\x1b[0m\n');

  // Test Suite 1: File & Assets Verification
  console.log('\x1b[1m[Suite 1] File & Asset Integrity Checks\x1b[0m');
  assert(fs.existsSync(path.join(rootDir, 'main.js')), 'main.js exists');
  assert(fs.existsSync(path.join(rootDir, 'preload.js')), 'preload.js exists');
  assert(fs.existsSync(path.join(rootDir, 'renderer', 'index.html')), 'renderer/index.html exists');
  assert(fs.existsSync(path.join(rootDir, 'renderer', 'styles.css')), 'renderer/styles.css exists');
  assert(fs.existsSync(path.join(rootDir, 'renderer', 'app.js')), 'renderer/app.js exists');
  assert(fs.existsSync(path.join(rootDir, 'public', 'index.html')), 'public/index.html exists (Web UI)');
  assert(fs.existsSync(path.join(rootDir, 'build', 'icon.icns')), 'build/icon.icns exists');
  assert(fs.existsSync(path.join(rootDir, 'assets', 'trayTemplate.png')), 'assets/trayTemplate.png exists');

  const icnsStats = fs.statSync(path.join(rootDir, 'build', 'icon.icns'));
  assert(icnsStats.size > 10000, `icon.icns is valid size (${icnsStats.size} bytes)`);

  const binPath = path.join(rootDir, 'bin', 'cloudflared');
  assert(fs.existsSync(binPath), 'cloudflared binary exists in bin/');
  const binStats = fs.statSync(binPath);
  assert((binStats.mode & 0o111) !== 0, 'cloudflared binary has executable permissions');

  // Test Suite 2: Paths & Config Module
  console.log('\n\x1b[1m[Suite 2] Paths & Config Module\x1b[0m');
  const { getDataDir, getPublicDir, getCloudflaredBin, getFfmpegBin } = await import('../server/paths.js');
  assert(getDataDir() === testDataDir, `getDataDir respects LOCAL_SERVER_DATA_DIR: ${getDataDir()}`);
  assert(fs.existsSync(getPublicDir()), `getPublicDir points to valid dir: ${getPublicDir()}`);
  assert(fs.existsSync(getCloudflaredBin()), `getCloudflaredBin resolves existing binary: ${getCloudflaredBin()}`);

  const ffmpegBin = getFfmpegBin();
  assert(ffmpegBin && fs.existsSync(ffmpegBin), `getFfmpegBin resolves valid executable binary: ${ffmpegBin}`);
  assert(!ffmpegBin.includes('.asar/'), `getFfmpegBin does not point into read-only asar`);

  const { loadConfig, verifyPassword } = await import('../server/config.js');
  const cfg = loadConfig();
  assert(cfg && typeof cfg === 'object', 'loadConfig() returns valid config object');
  assert(verifyPassword('mac1234', cfg), 'Default password verification succeeds for "mac1234"');

  // Test Suite 3: Local IP & System Info
  console.log('\n\x1b[1m[Suite 3] Network Interface & IP Resolution\x1b[0m');
  const { getLocalIpAddresses } = await import('../server/systemInfo.js');
  const ips = getLocalIpAddresses();
  assert(Array.isArray(ips) && ips.length > 0, `Detected local IP addresses (${ips.length} found)`);
  assert(ips[0].address && ips[0].interface, `Primary IP address resolved: ${ips[0].address} (${ips[0].interface})`);

  // Test Suite 4: Server Controller Startup & HTTP Responses
  console.log('\n\x1b[1m[Suite 4] Server Controller Lifecycle & HTTP API\x1b[0m');
  const { serverController } = await import('../server/serverController.js');

  const testPort = 7895;
  let statusEmitted = false;
  serverController.once('status', (s) => {
    statusEmitted = true;
  });

  const startRes = await serverController.start({ port: testPort, autoTunnel: false });
  assert(startRes.status === 'running', 'serverController.start() successfully marks status as "running"');
  assert(startRes.port === testPort, `serverController binds to port ${testPort}`);
  assert(statusEmitted, 'serverController emits "status" event');
  assert(startRes.localQr && startRes.localQr.startsWith('data:image/png;base64,'), 'Local QR code generated as valid PNG Data URL');

  // Test HTTP GET /api/auth/status
  const httpGet = (urlPath) => {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}${urlPath}`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, data, headers: res.headers });
        });
      }).on('error', reject);
    });
  };

  const authRes = await httpGet('/api/auth/status');
  assert(authRes.statusCode === 200, `GET /api/auth/status returns 200 OK`);
  const authJson = JSON.parse(authRes.data);
  assert(authJson.authenticated === false, 'Fresh session is unauthenticated as expected');

  // Test HTTP GET static index.html
  const indexRes = await httpGet('/');
  assert(indexRes.statusCode === 200, 'GET / returns 200 OK');
  assert(indexRes.data.includes('Personal Cloud Server') || indexRes.data.includes('Local'), 'GET / serves valid HTML content');

  // Test Stop Server
  console.log('\n\x1b[1m[Suite 5] Server Controller Shutdown\x1b[0m');
  const stopRes = await serverController.stop();
  assert(stopRes.status === 'stopped', 'serverController.stop() successfully marks status as "stopped"');

  // Verify port is released
  let portReleased = false;
  try {
    await httpGet('/');
  } catch (err) {
    portReleased = true;
  }
  assert(portReleased, 'HTTP port successfully released after server shutdown');

  // Clean up temporary test data dir
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch (e) {}

  // Summary Report
  console.log('\n\x1b[1m\x1b[36m===========================================\x1b[0m');
  console.log(`\x1b[1mTest Results:\x1b[0m ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('\x1b[1m\x1b[36m===========================================\x1b[0m\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
