import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'permission_requests.json');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function loadGuests() {
  if (fs.existsSync(GUESTS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf-8'));
      if (Array.isArray(data)) return data;
    } catch (e) {
      console.error('Error loading guests, attempting backup:', e);
    }
  }
  const bakFile = GUESTS_FILE + '.bak';
  if (fs.existsSync(bakFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(bakFile, 'utf-8'));
      if (Array.isArray(data)) {
        saveGuests(data);
        return data;
      }
    } catch (e) {}
  }
  return [];
}

export function saveGuests(guests) {
  try {
    const content = JSON.stringify(guests, null, 2);
    const tmpFile = GUESTS_FILE + '.tmp';
    const bakFile = GUESTS_FILE + '.bak';
    fs.writeFileSync(tmpFile, content, 'utf-8');
    fs.renameSync(tmpFile, GUESTS_FILE);
    fs.writeFileSync(bakFile, content, 'utf-8');
  } catch (e) {
    console.error('Error saving guests:', e);
  }
}

export function loadRequests() {
  if (fs.existsSync(REQUESTS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf-8'));
      if (Array.isArray(data)) return data;
    } catch (e) {
      console.error('Error loading permission requests, attempting backup:', e);
    }
  }
  const bakFile = REQUESTS_FILE + '.bak';
  if (fs.existsSync(bakFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(bakFile, 'utf-8'));
      if (Array.isArray(data)) {
        saveRequests(data);
        return data;
      }
    } catch (e) {}
  }
  return [];
}

export function saveRequests(requests) {
  try {
    const content = JSON.stringify(requests, null, 2);
    const tmpFile = REQUESTS_FILE + '.tmp';
    const bakFile = REQUESTS_FILE + '.bak';
    fs.writeFileSync(tmpFile, content, 'utf-8');
    fs.renameSync(tmpFile, REQUESTS_FILE);
    fs.writeFileSync(bakFile, content, 'utf-8');
  } catch (e) {
    console.error('Error saving permission requests:', e);
  }
}

export function createPermissionRequest(guestId, username, permission, name = null) {
  const allowed = ['canWrite', 'canDelete', 'canDownload'];
  if (!allowed.includes(permission)) {
    throw new Error('Invalid permission type requested.');
  }

  const permissionLabels = {
    canWrite: 'File Upload & Editing',
    canDelete: 'File Deleting',
    canDownload: 'File Downloads'
  };

  const requests = loadRequests();
  // Check if existing pending request already exists
  const existing = requests.find(r => r.guestId === guestId && r.permission === permission && r.status === 'pending');
  if (existing) {
    return existing;
  }

  const newReq = {
    id: 'req_' + crypto.randomBytes(6).toString('hex'),
    guestId,
    username,
    name: name || username,
    permission,
    permissionLabel: permissionLabels[permission] || permission,
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null
  };

  requests.push(newReq);
  saveRequests(requests);
  return newReq;
}

export function getMyRequests(guestId) {
  const requests = loadRequests();
  return requests.filter(r => r.guestId === guestId);
}

export function getPendingRequests() {
  const requests = loadRequests();
  return requests.filter(r => r.status === 'pending');
}

export function approvePermissionRequest(requestId) {
  const requests = loadRequests();
  const req = requests.find(r => r.id === requestId);
  if (!req) {
    throw new Error('Request not found.');
  }

  // Update guest permissions in guests.json
  const guests = loadGuests();
  const guest = guests.find(g => g.id === req.guestId || g.username.toLowerCase() === req.username.toLowerCase());
  if (guest) {
    guest.permissions = guest.permissions || {};
    guest.permissions[req.permission] = true;
    saveGuests(guests);
  }

  req.status = 'approved';
  req.resolvedAt = new Date().toISOString();
  saveRequests(requests);

  return { success: true, request: req };
}

export function declinePermissionRequest(requestId) {
  const requests = loadRequests();
  const req = requests.find(r => r.id === requestId);
  if (!req) {
    throw new Error('Request not found.');
  }

  req.status = 'declined';
  req.resolvedAt = new Date().toISOString();
  saveRequests(requests);

  return { success: true, request: req };
}

function sanitizeCustomFolders(folders) {
  if (!Array.isArray(folders)) return [];
  const result = [];
  for (const item of folders) {
    const rawPath = typeof item === 'string' ? item : item?.path;
    if (rawPath && typeof rawPath === 'string' && rawPath.trim()) {
      const fullPath = path.resolve(rawPath.trim());
      const folderName = (typeof item === 'object' && item.name && item.name.trim())
        ? item.name.trim()
        : path.basename(fullPath);
      if (!result.some(f => f.path === fullPath)) {
        result.push({
          name: folderName || 'Folder',
          path: fullPath
        });
      }
    }
  }
  return result;
}

export function getGuests() {
  const guests = loadGuests();
  return guests.map(g => ({
    id: g.id,
    name: g.name || g.username,
    username: g.username,
    password: g.plainPassword || g.password || '******',
    plainPassword: g.plainPassword || g.password || '******',
    permissions: {
      canWrite: g.permissions?.canWrite ?? false,
      canDelete: g.permissions?.canDelete ?? false,
      canDownload: g.permissions?.canDownload ?? false,
      folderAccess: {
        customFolders: Array.isArray(g.permissions?.folderAccess?.customFolders)
          ? g.permissions.folderAccess.customFolders
          : []
      }
    },
    createdAt: g.createdAt
  }));
}

export function createGuest(name, username, password, permissions = {}) {
  const cleanUsername = (username || '').trim().toLowerCase();
  const displayName = (name || cleanUsername).trim();
  if (!cleanUsername || cleanUsername === 'admin') {
    throw new Error('Invalid username. "admin" is reserved.');
  }
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }

  const guests = loadGuests();
  if (guests.some(g => g.username.toLowerCase() === cleanUsername)) {
    throw new Error(`Username "${cleanUsername}" already exists.`);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  const folderAccess = {
    customFolders: sanitizeCustomFolders(permissions.folderAccess?.customFolders)
  };

  const newGuest = {
    id: 'guest_' + crypto.randomBytes(6).toString('hex'),
    name: displayName,
    username: cleanUsername,
    plainPassword: password,
    salt,
    hash,
    role: 'guest',
    permissions: {
      canWrite: permissions.canWrite ?? false,
      canDelete: permissions.canDelete ?? false,
      canDownload: permissions.canDownload ?? false,
      folderAccess
    },
    createdAt: new Date().toISOString()
  };

  guests.push(newGuest);
  saveGuests(guests);

  return {
    id: newGuest.id,
    name: newGuest.name,
    username: newGuest.username,
    password: newGuest.plainPassword,
    permissions: newGuest.permissions,
    createdAt: newGuest.createdAt
  };
}

export function deleteGuest(id) {
  const guests = loadGuests();
  const index = guests.findIndex(g => g.id === id);
  if (index === -1) {
    throw new Error('Guest not found.');
  }
  const deleted = guests.splice(index, 1)[0];
  saveGuests(guests);
  return { success: true, username: deleted.username };
}

export function updateGuest(id, updates = {}) {
  const guests = loadGuests();
  const guest = guests.find(g => g.id === id);
  if (!guest) {
    throw new Error('Guest not found.');
  }

  if (updates.name && typeof updates.name === 'string' && updates.name.trim()) {
    guest.name = updates.name.trim();
  }

  if (updates.password) {
    if (updates.password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    guest.salt = salt;
    guest.hash = hashPassword(updates.password, salt);
    guest.plainPassword = updates.password;
    guest.password = updates.password;
  }

  if (updates.permissions) {
    const curFolder = guest.permissions?.folderAccess || { customFolders: [] };
    const newFA = updates.permissions.folderAccess;
    guest.permissions = {
      ...guest.permissions,
      ...updates.permissions,
      folderAccess: newFA ? {
        customFolders: newFA.customFolders !== undefined
          ? sanitizeCustomFolders(newFA.customFolders)
          : (curFolder.customFolders || [])
      } : curFolder
    };
  }

  saveGuests(guests);
  return {
    success: true,
    guest: {
      id: guest.id,
      name: guest.name || guest.username,
      username: guest.username,
      password: guest.plainPassword || guest.password || '******',
      permissions: guest.permissions
    }
  };
}

export function updateGuestPassword(id, newPassword) {
  return updateGuest(id, { password: newPassword });
}

export function updateGuestPermissions(id, permissions) {
  return updateGuest(id, { permissions });
}

export function verifyGuestPassword(guest, password) {
  const hash = hashPassword(password, guest.salt);
  return hash === guest.hash;
}

export function authenticateUser(username, password, adminConfig) {
  const u = (username || 'admin').trim().toLowerCase();

  // Admin authentication
  if (u === 'admin') {
    const adminHash = hashPassword(password, adminConfig.passwordSalt);
    if (adminHash === adminConfig.passwordHash) {
      return {
        success: true,
        user: {
          username: 'admin',
          role: 'admin',
          permissions: {
            canWrite: true,
            canDelete: true,
            canDownload: true,
            folderAccess: { desktop: true, documents: true, downloads: true, customFolders: [] }
          }
        }
      };
    }
    return { success: false, error: 'Invalid password for admin.' };
  }

  // Guest authentication
  const guests = loadGuests();
  const guest = guests.find(g => g.username.toLowerCase() === u);
  if (!guest) {
    return { success: false, error: `User "${u}" not found.` };
  }

  if (verifyGuestPassword(guest, password)) {
    return {
      success: true,
      user: {
        id: guest.id,
        name: guest.name || guest.username,
        username: guest.username,
        role: 'guest',
        permissions: {
          canWrite: guest.permissions?.canWrite ?? false,
          canDelete: guest.permissions?.canDelete ?? false,
          canDownload: guest.permissions?.canDownload ?? false,
          folderAccess: {
            customFolders: Array.isArray(guest.permissions?.folderAccess?.customFolders)
              ? guest.permissions.folderAccess.customFolders
              : []
          }
        }
      }
    };
  }

  return { success: false, error: 'Invalid password.' };
}

export function updateGuestSelfProfile(guestId, { name, username, password }) {
  const guests = loadGuests();
  const guest = guests.find(g => g.id === guestId || g.username.toLowerCase() === String(guestId).toLowerCase());
  if (!guest) {
    throw new Error('Guest profile not found.');
  }

  if (name && typeof name === 'string' && name.trim()) {
    guest.name = name.trim();
  }

  if (username && typeof username === 'string' && username.trim()) {
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername === 'admin') {
      throw new Error('Username "admin" is reserved.');
    }
    const existing = guests.find(g => g.id !== guest.id && g.username.toLowerCase() === cleanUsername);
    if (existing) {
      throw new Error(`Username "${username}" is already taken by another account.`);
    }
    guest.username = username.trim();
  }

  let passwordChanged = false;
  if (password && typeof password === 'string' && password.trim()) {
    const cleanPass = password.trim();
    if (cleanPass.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(cleanPass, salt);
    guest.salt = salt;
    guest.hash = hash;
    guest.password = cleanPass;
    guest.plainPassword = cleanPass;
    passwordChanged = true;
  }

  saveGuests(guests);
  return {
    success: true,
    passwordChanged,
    user: {
      id: guest.id,
      name: guest.name || guest.username,
      username: guest.username,
      role: 'guest',
      permissions: guest.permissions
    }
  };
}

export function markRequestsAsReadForGuest(guestId) {
  const requests = loadRequests();
  let changed = false;
  requests.forEach(r => {
    if ((r.guestId === guestId || r.username.toLowerCase() === String(guestId).toLowerCase()) && r.status !== 'pending' && !r.read) {
      r.read = true;
      changed = true;
    }
  });
  if (changed) {
    saveRequests(requests);
  }
  return { success: true };
}

