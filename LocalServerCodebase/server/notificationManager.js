import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'downloads.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadActivities() {
  ensureDataDir();
  if (fs.existsSync(ACTIVITIES_FILE)) {
    try {
      const raw = fs.readFileSync(ACTIVITIES_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.error('Error loading activities, checking backup:', err);
    }
  }
  const bak = ACTIVITIES_FILE + '.bak';
  if (fs.existsSync(bak)) {
    try {
      const raw = fs.readFileSync(bak, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    } catch (err) {}
  }
  return [];
}

function saveActivities(items) {
  ensureDataDir();
  try {
    const content = JSON.stringify(items, null, 2);
    const tmp = ACTIVITIES_FILE + '.tmp';
    const bak = ACTIVITIES_FILE + '.bak';
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, ACTIVITIES_FILE);
    fs.writeFileSync(bak, content, 'utf-8');
  } catch (err) {
    console.error('Error saving activities:', err);
  }
}

export function recordDownloadActivity({ user, filePath, fileName, fileSize, isDirectory }) {
  const activities = loadActivities();
  const id = 'dl_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();

  const activity = {
    id,
    type: 'download',
    userId: user?.id || user?.username || 'user',
    username: user?.username || 'unknown',
    name: user?.name || user?.username || 'User',
    role: user?.role || 'guest',
    filePath: filePath || '',
    fileName: fileName || path.basename(filePath || 'file'),
    fileSize: typeof fileSize === 'number' ? fileSize : 0,
    isDirectory: Boolean(isDirectory),
    read: false,
    timestamp: now,
    downloadedAt: now
  };

  activities.unshift(activity);
  if (activities.length > 200) {
    activities.length = 200;
  }
  saveActivities(activities);
  return activity;
}

export function recordAccountActivity({ type = 'account_activity', userId, username, name, role = 'guest', actionText, meta = {} }) {
  const activities = loadActivities();
  const id = 'act_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();

  const activity = {
    id,
    type,
    userId: userId || username || 'user',
    username: username || 'unknown',
    name: name || username || 'User',
    role: role || 'guest',
    actionText: actionText || 'Account updated',
    meta: meta || {},
    read: false,
    timestamp: now,
    downloadedAt: now
  };

  activities.unshift(activity);
  if (activities.length > 200) {
    activities.length = 200;
  }
  saveActivities(activities);
  return activity;
}

export function getDownloadActivities() {
  const activities = loadActivities();
  return activities.sort((a, b) => new Date(b.timestamp || b.downloadedAt) - new Date(a.timestamp || a.downloadedAt));
}

export function getUnreadDownloadsCount() {
  const activities = loadActivities();
  return activities.filter(d => !d.read && (!d.type || d.type === 'download')).length;
}

export function getUnreadSecurityCount() {
  const activities = loadActivities();
  return activities.filter(d => !d.read && (d.type === 'guest_password_changed' || d.type === 'account_activity')).length;
}

export function markDownloadsAsRead(activityId = null) {
  const activities = loadActivities();
  if (activityId) {
    const item = activities.find(d => d.id === activityId);
    if (item) item.read = true;
  } else {
    activities.forEach(d => { d.read = true; });
  }
  saveActivities(activities);
  return { success: true };
}

export function clearDownloadActivities() {
  saveActivities([]);
  return { success: true };
}
