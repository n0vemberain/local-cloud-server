import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

const defaultConfig = {
  port: parseInt(process.env.PORT || '7890', 10),
  host: '0.0.0.0',
  serverName: `${os.hostname()}'s Cloud Server`,
  defaultRootDir: os.homedir(),
  sessionSecret: crypto.randomBytes(32).toString('hex'),
  // Default master password is 'mac1234' unless changed
  passwordSalt: crypto.randomBytes(16).toString('hex'),
  passwordHash: '',
  isConfigured: false,
  autoTunnel: true // automatically start Cloudflare tunnel for remote internet access
};

// Compute hash for default password
defaultConfig.passwordHash = hashPassword('mac1234', defaultConfig.passwordSalt);

export function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...defaultConfig, ...data };
    } catch (err) {
      console.error('Error loading config file, attempting backup:', err);
    }
  }
  const bak = CONFIG_FILE + '.bak';
  if (fs.existsSync(bak)) {
    try {
      const data = JSON.parse(fs.readFileSync(bak, 'utf-8'));
      return { ...defaultConfig, ...data };
    } catch (err) {}
  }
  saveConfig(defaultConfig);
  return defaultConfig;
}

export function saveConfig(cfg) {
  try {
    const content = JSON.stringify(cfg, null, 2);
    const tmp = CONFIG_FILE + '.tmp';
    const bak = CONFIG_FILE + '.bak';
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, CONFIG_FILE);
    fs.writeFileSync(bak, content, 'utf-8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

export function verifyPassword(password, cfg) {
  const hash = hashPassword(password, cfg.passwordSalt);
  return hash === cfg.passwordHash;
}

export function updatePassword(newPassword, cfg) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);
  cfg.passwordSalt = salt;
  cfg.passwordHash = hash;
  cfg.isConfigured = true;
  saveConfig(cfg);
  return true;
}

export function updateServerName(newName, cfg) {
  if (!newName || typeof newName !== 'string' || !newName.trim()) {
    throw new Error('Server name cannot be empty.');
  }
  cfg.serverName = newName.trim();
  saveConfig(cfg);
  return cfg.serverName;
}

export function updateAdminProfile(name, currentPassword, newPassword, cfg) {
  if (name && typeof name === 'string' && name.trim()) {
    cfg.adminName = name.trim();
  }
  if (newPassword && newPassword.trim()) {
    if (!currentPassword) {
      throw new Error('Current password is required to set a new password.');
    }
    if (!verifyPassword(currentPassword, cfg)) {
      throw new Error('Current admin password is incorrect.');
    }
    if (newPassword.trim().length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(newPassword.trim(), salt);
    cfg.passwordSalt = salt;
    cfg.passwordHash = hash;
    cfg.isConfigured = true;
  }
  saveConfig(cfg);
  return { success: true, adminName: cfg.adminName || 'Administrator' };
}


