import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import QRCode from 'qrcode';

import { loadConfig, updateServerName, updateAdminProfile } from './config.js';
import {
  authMiddleware,
  requireAdmin,
  checkPermission,
  handleLogin,
  handleLogout,
  handleAuthStatus,
  handleChangePassword,
  generateToken
} from './auth.js';
import {
  listDirectory,
  readTextFile,
  writeTextFile,
  createDirectory,
  createFile,
  renameItem,
  deleteItem,
  searchInDirectory,
  isPathAllowedForUser
} from './fileManager.js';
import { handleFileDownload, handleFileStream } from './streamHandler.js';
import { getMacMetrics } from './systemInfo.js';
import { startTunnel, stopTunnel, getTunnelStatus } from './tunnelManager.js';
import { getActiveSessions, getSessionHistory, revokeSession } from './sessionTracker.js';
import {
  getGuests,
  createGuest,
  deleteGuest,
  updateGuest,
  updateGuestPassword,
  updateGuestPermissions,
  updateGuestSelfProfile,
  getMyRequests,
  getPendingRequests,
  createPermissionRequest,
  approvePermissionRequest,
  declinePermissionRequest,
  markRequestsAsReadForGuest
} from './userManager.js';
import {
  createMessage,
  getMessagesForUser,
  markMessageAsRead,
  markAllMessagesAsRead,
  deleteMessage,
  getUnreadMessagesCount,
  getChatRecipients
} from './messageManager.js';
import {
  recordAccountActivity,
  getDownloadActivities,
  getUnreadDownloadsCount,
  getUnreadSecurityCount,
  markDownloadsAsRead,
  clearDownloadActivities
} from './notificationManager.js';

export function createApp() {
  const app = express();
  const cfg = loadConfig();

  app.set('trust proxy', true);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Static directory for client UI assets
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));

  // Multer setup for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = req.headers['x-upload-dir'] || req.query.uploadDir || cfg.defaultRootDir;
      const safeDir = path.resolve(uploadDir);
      if (!isPathAllowedForUser(safeDir, req.user)) {
        return cb(new Error('Access denied. You do not have permission to upload to this directory.'));
      }
      if (!fs.existsSync(safeDir)) {
        fs.mkdirSync(safeDir, { recursive: true });
      }
      cb(null, safeDir);
    },
    filename: (req, file, cb) => {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, originalName);
    }
  });
  const upload = multer({ storage });

  // ---------------- AUTH ROUTES ----------------
  app.post('/api/auth/login', handleLogin);
  app.post('/api/auth/logout', handleLogout);
  app.get('/api/auth/status', handleAuthStatus);
  app.post('/api/auth/change-password', authMiddleware, requireAdmin, handleChangePassword);
  app.post('/api/settings/server-name', authMiddleware, requireAdmin, (req, res) => {
    try {
      const { name } = req.body;
      const updated = updateServerName(name, cfg);
      res.json({ success: true, serverName: updated });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ---------------- CONNECTION & ACTIVITY TRACKING ----------------
  app.get('/api/activity/connections', authMiddleware, requireAdmin, (req, res) => {
    try {
      const active = getActiveSessions();
      const history = getSessionHistory();

      const safeActive = active.map(s => ({
        sessionId: s.sessionId,
        username: s.username,
        role: s.role,
        ip: s.ip,
        networkType: s.networkType,
        device: s.device,
        loginTime: s.loginTime,
        lastActive: s.lastActive,
        isOnline: s.isOnline
      }));

      const safeHistory = history.map(h => ({
        id: h.id,
        username: h.username,
        role: h.role,
        ip: h.ip,
        networkType: h.networkType,
        device: h.device,
        timestamp: h.timestamp
      }));

      res.json({
        success: true,
        activeCount: safeActive.filter(s => s.isOnline).length,
        active: safeActive,
        history: safeHistory
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/activity/revoke', authMiddleware, requireAdmin, (req, res) => {
    try {
      const { sessionId } = req.body;
      const revoked = revokeSession(sessionId);
      res.json({ success: true, revoked });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ---------------- GUEST MANAGEMENT ROUTES ----------------
  app.get('/api/guests', authMiddleware, requireAdmin, (req, res) => {
    try {
      const guests = getGuests();
      res.json({ success: true, guests });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/guests/create', authMiddleware, requireAdmin, (req, res) => {
    try {
      const { name, username, password, permissions } = req.body;
      const guest = createGuest(name, username, password, permissions);
      res.json({ success: true, guest });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/guests/delete', authMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.body;
      const result = deleteGuest(id);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/guests/update', authMiddleware, requireAdmin, (req, res) => {
    try {
      const { id, name, password, permissions } = req.body;
      const result = updateGuest(id, { name, password, permissions });
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ---------------- PERMISSION REQUEST ROUTES ----------------
  app.get('/api/requests/my', authMiddleware, (req, res) => {
    try {
      const guestId = req.user?.id || req.user?.username;
      const requests = getMyRequests(guestId);
      res.json({ success: true, requests });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/requests/create', authMiddleware, (req, res) => {
    try {
      if (req.user?.role === 'admin') {
        return res.status(400).json({ success: false, error: 'Admin already has full access.' });
      }
      const { permission } = req.body;
      const guestId = req.user?.id || req.user?.username;
      const username = req.user?.username;
      const name = req.user?.name || username;
      const request = createPermissionRequest(guestId, username, permission, name);
      res.json({ success: true, request });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/requests/pending', authMiddleware, requireAdmin, (req, res) => {
    try {
      const pending = getPendingRequests();
      res.json({ success: true, pending });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/requests/approve', authMiddleware, requireAdmin, (req, res) => {
    try {
      const { requestId } = req.body;
      const result = approvePermissionRequest(requestId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/requests/decline', authMiddleware, requireAdmin, (req, res) => {
    try {
      const { requestId } = req.body;
      const result = declinePermissionRequest(requestId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ---------------- MESSAGE & NOTIFICATION ROUTES ----------------
  app.get('/api/messages/recipients', authMiddleware, (req, res) => {
    try {
      const allGuests = getGuests();
      const recipients = getChatRecipients(req.user, allGuests);
      res.json({ success: true, recipients });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/messages', authMiddleware, (req, res) => {
    try {
      const messages = getMessagesForUser(req.user);
      res.json({ success: true, messages });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/messages/send', authMiddleware, (req, res) => {
    try {
      const messageText = req.body?.message || req.body?.text;
      const recipientId = req.body?.recipientId || 'admin';
      const replyToMessageId = req.body?.replyToMessageId;
      if (replyToMessageId) {
        try {
          markMessageAsRead(replyToMessageId, req.user);
        } catch (e) {}
      }

      const allGuests = getGuests();
      const targetGuest = allGuests.find(g => g.id === recipientId || g.username.toLowerCase() === recipientId.toLowerCase());
      const recipient = {
        id: targetGuest ? targetGuest.id : recipientId,
        username: targetGuest ? targetGuest.username : (req.body?.recipientUsername || recipientId),
        name: targetGuest ? (targetGuest.name || targetGuest.username) : (req.body?.recipientName || recipientId)
      };

      const newMsg = createMessage(req.user, recipient, messageText);
      res.json({ success: true, message: newMsg });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/messages/read', authMiddleware, (req, res) => {
    try {
      const { messageId, all } = req.body;
      if (all) {
        const result = markAllMessagesAsRead(req.user);
        return res.json(result);
      }
      const result = markMessageAsRead(messageId, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/messages/delete', authMiddleware, (req, res) => {
    try {
      const { messageId } = req.body;
      const result = deleteMessage(messageId, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/notifications/summary', authMiddleware, (req, res) => {
    try {
      const isAdmin = req.user?.role === 'admin';
      const unreadMsgCount = getUnreadMessagesCount(req.user);
      if (isAdmin) {
        const pending = getPendingRequests();
        const unreadDownloads = getUnreadDownloadsCount();
        const unreadSecurity = getUnreadSecurityCount();
        const downloads = getDownloadActivities();
        const allMessages = getMessagesForUser(req.user);
        const totalNotifications = pending.length + unreadDownloads + unreadSecurity;
        return res.json({
          success: true,
          isAdmin: true,
          pendingRequests: pending,
          pendingRequestsCount: pending.length,
          unreadDownloadsCount: unreadDownloads,
          unreadSecurityCount: unreadSecurity,
          downloads: downloads.slice(0, 50),
          totalNotifications,
          unreadMessagesCount: unreadMsgCount,
          totalUnread: totalNotifications + unreadMsgCount,
          messages: allMessages
        });
      } else {
        const guestId = req.user?.id || req.user?.username;
        const myRequests = getMyRequests(guestId);
        const myMessages = getMessagesForUser(req.user);
        const unreadRequests = myRequests.filter(r => r.status !== 'pending' && !r.read).length;
        return res.json({
          success: true,
          isAdmin: false,
          requests: myRequests,
          totalNotifications: unreadRequests,
          unreadMessagesCount: unreadMsgCount,
          totalUnread: unreadRequests + unreadMsgCount,
          messages: myMessages
        });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/notifications/downloads', authMiddleware, requireAdmin, (req, res) => {
    try {
      const downloads = getDownloadActivities();
      res.json({ success: true, downloads });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/notifications/downloads/read', authMiddleware, requireAdmin, (req, res) => {
    try {
      const { downloadId } = req.body;
      const result = markDownloadsAsRead(downloadId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/notifications/requests/read', authMiddleware, (req, res) => {
    try {
      const guestId = req.user?.id || req.user?.username;
      const result = markRequestsAsReadForGuest(guestId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- USER PROFILE ROUTES ----------------
  app.get('/api/profile', authMiddleware, (req, res) => {
    try {
      const cfg = loadConfig();
      const isAdmin = req.user?.role === 'admin';
      if (isAdmin) {
        const userObj = {
          role: 'admin',
          id: 'admin',
          username: 'admin',
          name: cfg.adminName || 'Administrator',
          serverName: cfg.serverName
        };
        return res.json({
          success: true,
          user: userObj,
          profile: userObj
        });
      } else {
        const allGuests = getGuests();
        const currentGuest = allGuests.find(g => g.id === req.user.id || g.username.toLowerCase() === (req.user.username || '').toLowerCase());
        const userObj = {
          role: 'guest',
          id: currentGuest ? currentGuest.id : req.user.id,
          username: currentGuest ? currentGuest.username : req.user.username,
          name: currentGuest ? (currentGuest.name || currentGuest.username) : req.user.name,
          serverName: cfg.serverName
        };
        return res.json({
          success: true,
          user: userObj,
          profile: userObj
        });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/profile/update', authMiddleware, (req, res) => {
    try {
      const cfg = loadConfig();
      const isAdmin = req.user?.role === 'admin';

      if (isAdmin) {
        const { name, currentPassword, newPassword } = req.body;
        const result = updateAdminProfile(name, currentPassword, newPassword, cfg);
        req.user.name = result.adminName;
        const { token } = generateToken(req.user, cfg);
        res.cookie('mac_token', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000
        });
        return res.json({
          success: true,
          message: 'Admin profile updated successfully',
          user: {
            role: 'admin',
            username: 'admin',
            name: result.adminName
          }
        });
      } else {
        const guestId = req.user?.id || req.user?.username;
        const { name, username, password } = req.body;
        const result = updateGuestSelfProfile(guestId, { name, username, password });
        req.user.name = result.user.name;
        req.user.username = result.user.username;

        if (result.passwordChanged) {
          recordAccountActivity({
            type: 'guest_password_changed',
            userId: result.user.id,
            username: result.user.username,
            name: result.user.name,
            role: 'guest',
            actionText: `Guest @${result.user.username} (${result.user.name}) updated their account password.`,
            meta: {
              guestId: result.user.id,
              username: result.user.username,
              guestUsername: result.user.username,
              newPassword: password.trim()
            }
          });
        }

        const { token } = generateToken(result.user, cfg);
        res.cookie('mac_token', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000
        });
        return res.json({
          success: true,
          message: 'Profile updated successfully',
          user: result.user
        });
      }
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/files/validate-path', authMiddleware, requireAdmin, (req, res) => {
    try {
      const rawPath = req.body.path;
      if (!rawPath || typeof rawPath !== 'string' || !rawPath.trim()) {
        return res.status(400).json({ success: false, error: 'Path is required.' });
      }
      const safePath = path.resolve(rawPath.trim());
      if (!fs.existsSync(safePath)) {
        return res.status(404).json({ success: false, error: 'Directory does not exist on this machine.' });
      }
      const stat = fs.statSync(safePath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ success: false, error: 'Specified path is a file, not a directory.' });
      }
      const folderName = path.basename(safePath) || safePath;
      res.json({ success: true, path: safePath, name: folderName });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ---------------- FILE ROUTES (Protected + Permission checked) ----------------
  app.get('/api/files/browse', authMiddleware, async (req, res) => {
    try {
      const targetPath = req.query.path || (req.user?.role === 'guest' ? null : cfg.defaultRootDir);
      const showHidden = req.query.showHidden === 'true';
      const result = await listDirectory(targetPath, showHidden, req.user);
      res.json({ success: true, ...result, user: req.user });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/files/search', authMiddleware, async (req, res) => {
    try {
      const { path: searchPath, q } = req.query;
      if (!q) return res.json({ success: true, results: [] });
      const targetSearchDir = searchPath || (req.user?.role === 'guest' ? null : cfg.defaultRootDir);
      const results = await searchInDirectory(targetSearchDir, q, 50, req.user);
      res.json({ success: true, results });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/files/read', authMiddleware, async (req, res) => {
    try {
      const result = await readTextFile(req.query.path, req.user);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/files/write', authMiddleware, checkPermission('canWrite'), async (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      const result = await writeTextFile(filePath, content, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/files/mkdir', authMiddleware, checkPermission('canWrite'), async (req, res) => {
    try {
      const { path: dirPath } = req.body;
      const result = await createDirectory(dirPath, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/files/create', authMiddleware, checkPermission('canWrite'), async (req, res) => {
    try {
      const { path: filePath } = req.body;
      const result = await createFile(filePath, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/files/rename', authMiddleware, checkPermission('canWrite'), async (req, res) => {
    try {
      const { oldPath, newName } = req.body;
      const result = await renameItem(oldPath, newName, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/files/delete', authMiddleware, checkPermission('canDelete'), async (req, res) => {
    try {
      const { path: targetPath, permanent } = req.body;
      const result = await deleteItem(targetPath, permanent, req.user);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/files/upload', authMiddleware, checkPermission('canWrite'), upload.array('files'), (req, res) => {
    try {
      const files = req.files || [];
      res.json({
        success: true,
        message: `${files.length} file(s) uploaded successfully!`,
        files: files.map(f => ({ name: f.originalname, size: f.size }))
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/files/download', authMiddleware, checkPermission('canDownload'), handleFileDownload);
  app.get('/api/files/stream', authMiddleware, handleFileStream);

  // ---------------- SYSTEM & TUNNEL ROUTES ----------------
  app.get('/api/system/metrics', authMiddleware, async (req, res) => {
    try {
      const metrics = await getMacMetrics();
      res.json({ success: true, ...metrics });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/system/tunnel', authMiddleware, (req, res) => {
    res.json(getTunnelStatus());
  });

  app.post('/api/system/tunnel/toggle', authMiddleware, requireAdmin, async (req, res) => {
    const { action } = req.body;
    if (action === 'start') {
      const status = await startTunnel(cfg.port);
      return res.json(status);
    } else {
      const status = stopTunnel();
      return res.json(status);
    }
  });

  app.get('/api/system/qr', authMiddleware, async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL required');
    try {
      const qrDataUrl = await QRCode.toDataURL(url, { margin: 2, scale: 6 });
      res.json({ success: true, qr: qrDataUrl });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/', authMiddleware, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
