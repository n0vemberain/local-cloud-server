import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getDataDir() {
  if (process.env.LOCAL_SERVER_DATA_DIR) {
    if (!fs.existsSync(process.env.LOCAL_SERVER_DATA_DIR)) {
      try {
        fs.mkdirSync(process.env.LOCAL_SERVER_DATA_DIR, { recursive: true });
      } catch (e) {}
    }
    return process.env.LOCAL_SERVER_DATA_DIR;
  }

  // Detect if packaged inside Electron (.asar) or running under Electron
  const isInsideAsar = __filename.includes('.asar');
  if (isInsideAsar || process.versions?.electron) {
    let baseDataDir;
    if (process.platform === 'darwin') {
      baseDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'Local Cloud Server', 'data');
    } else if (process.platform === 'win32') {
      baseDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Local Cloud Server', 'data');
    } else {
      baseDataDir = path.join(os.homedir(), '.config', 'Local Cloud Server', 'data');
    }

    try {
      if (!fs.existsSync(baseDataDir)) {
        fs.mkdirSync(baseDataDir, { recursive: true });
      }
    } catch (e) {}

    process.env.LOCAL_SERVER_DATA_DIR = baseDataDir;
    return baseDataDir;
  }

  const dir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }
  return dir;
}

export function getPublicDir() {
  if (process.env.LOCAL_SERVER_PUBLIC_DIR && fs.existsSync(process.env.LOCAL_SERVER_PUBLIC_DIR)) {
    return process.env.LOCAL_SERVER_PUBLIC_DIR;
  }
  const directPublic = path.resolve(__dirname, '../public');
  if (fs.existsSync(directPublic)) {
    return directPublic;
  }
  return directPublic;
}

export function getCloudflaredBin() {
  if (process.env.CLOUDFLARED_BIN_PATH && fs.existsSync(process.env.CLOUDFLARED_BIN_PATH)) {
    return process.env.CLOUDFLARED_BIN_PATH;
  }
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'cloudflared.exe' : 'cloudflared';

  // Check adjacent bin directory
  const localBinary = path.resolve(__dirname, '../bin', binaryName);
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  // Check packaged Electron resourcesPath
  if (process.resourcesPath) {
    const resBin = path.join(process.resourcesPath, 'bin', binaryName);
    if (fs.existsSync(resBin)) {
      return resBin;
    }
    const appBin = path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', binaryName);
    if (fs.existsSync(appBin)) {
      return appBin;
    }
  }

  // Check cwd/bin
  const cwdBinary = path.join(process.cwd(), 'bin', binaryName);
  if (fs.existsSync(cwdBinary)) {
    return cwdBinary;
  }

  return binaryName;
}

export function getFfmpegBin(defaultPath = null) {
  let bin = defaultPath;
  if (bin && typeof bin === 'string') {
    if (bin.includes('.asar')) {
      const unpacked = bin.replace('.asar', '.asar.unpacked');
      if (fs.existsSync(unpacked)) {
        return unpacked;
      }
    }
    if (fs.existsSync(bin)) {
      return bin;
    }
  }

  // Check packaged Electron app.asar.unpacked
  if (process.resourcesPath) {
    const resBin = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg');
    if (fs.existsSync(resBin)) {
      return resBin;
    }
  }

  // Check node_modules in project
  const projectBin = path.resolve(__dirname, '../node_modules/ffmpeg-static/ffmpeg');
  if (fs.existsSync(projectBin)) {
    return projectBin;
  }

  // System fallbacks on macOS
  if (fs.existsSync('/opt/homebrew/bin/ffmpeg')) return '/opt/homebrew/bin/ffmpeg';
  if (fs.existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
  if (fs.existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';

  return bin || null;
}
