import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { getDataDir } from './paths.js';

function getConfigFile() {
  return path.join(getDataDir(), 'config.json');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

const defaultConfig = {
  port: parseInt(process.env.PORT || '7890', 10),
  host: '0.0.0.0',
  serverName: `${os.hostname()}'s Cloud Server`,
  defaultRootDir: os.homedir(),
  sessionSecret: crypto.randomBytes(32).toString('hex'),
  // Default master password is 'win1234' unless changed
  passwordSalt: crypto.randomBytes(16).toString('hex'),
  passwordHash: '',
  isConfigured: false,
  autoTunnel: true // automatically start Cloudflare tunnel for remote internet access
};

// Compute hash for default password
defaultConfig.passwordHash = hashPassword('win1234', defaultConfig.passwordSalt);

export function loadConfig() {
  const configFile = getConfigFile();
  if (fs.existsSync(configFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      return { ...defaultConfig, ...data };
    } catch (err) {
      console.error('Error loading config file, attempting backup:', err);
    }
  }
  const bak = configFile + '.bak';
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
    const configFile = getConfigFile();
    const content = JSON.stringify(cfg, null, 2);
    const tmp = configFile + '.tmp';
    const bak = configFile + '.bak';
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, configFile);
    fs.writeFileSync(bak, content, 'utf-8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

export function verifyPassword(password, cfg) {
  const hash = hashPassword(password, cfg.passwordSalt);
  if (hash === cfg.passwordHash) return true;
  // If not configured yet, also allow 'win1234' or 'mac1234'
  if (!cfg.isConfigured && (password === 'win1234' || password === 'mac1234')) {
    return true;
  }
  return false;
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
    if (newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters.');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    cfg.passwordSalt = salt;
    cfg.passwordHash = hashPassword(newPassword, salt);
    cfg.isConfigured = true;
  }
  saveConfig(cfg);
  return true;
}
