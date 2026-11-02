import crypto from 'crypto';
import { loadConfig, updatePassword } from './config.js';
import { authenticateUser, loadGuests } from './userManager.js';
import { recordSession, updateSessionActivity, revokeSession, isSessionRevoked } from './sessionTracker.js';

const failedAttempts = new Map();

function cleanOldAttempts() {
  const now = Date.now();
  for (const [ip, data] of failedAttempts.entries()) {
    if (now - data.timestamp > 5 * 60 * 1000) {
      failedAttempts.delete(ip);
    }
  }
}

export function generateToken(user, cfg) {
  const sessionId = 'sess_' + crypto.randomBytes(16).toString('hex');
  const payload = {
    auth: true,
    sessionId,
    name: user.name || user.username,
    username: user.username,
    role: user.role,
    permissions: user.permissions,
    created: Date.now(),
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', cfg.sessionSecret)
    .update(data)
    .digest('base64url');
  return { token: `${data}.${signature}`, sessionId, payload };
}

export function verifyToken(token, cfg) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', cfg.sessionSecret)
    .update(data)
    .digest('base64url');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (Date.now() > payload.expires) return null;
    if (!payload.role) {
      payload.role = 'admin';
      payload.username = 'admin';
      payload.permissions = { canWrite: true, canDelete: true, canDownload: true };
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const cfg = loadConfig();
  
  // Public paths
  const publicPaths = ['/api/auth/login', '/api/auth/status', '/login.html', '/favicon.ico'];
  if (publicPaths.includes(req.path) || req.path.startsWith('/public/')) {
    return next();
  }

  let token = req.cookies?.cloud_token || req.cookies?.mac_token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }
  if (!token && req.query?.auth_token) {
    token = req.query.auth_token;
  }

  const payload = verifyToken(token, cfg);
  if (payload) {
    if (payload.sessionId && isSessionRevoked(payload.sessionId)) {
      res.clearCookie('cloud_token');
      res.clearCookie('mac_token');
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'Session was disconnected by administrator. Please log in again.' });
      }
      return res.redirect('/login.html');
    }

    if (payload.role === 'guest') {
      const guests = loadGuests();
      const currentGuest = guests.find(g => g.username.toLowerCase() === payload.username.toLowerCase());
      if (currentGuest) {
        payload.name = currentGuest.name || currentGuest.username;
        if (currentGuest.permissions) {
          payload.permissions = currentGuest.permissions;
        }
        payload.id = currentGuest.id;
      }
    }
    req.user = payload;
    updateSessionActivity(payload.sessionId, req, payload.username, payload.role);
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
  }

  return res.redirect('/login.html');
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

export function checkPermission(permissionKey) {
  return (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    if (req.user?.role === 'guest' && req.user?.permissions?.[permissionKey]) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: `Access denied. Guest account does not have '${permissionKey}' permission.`
    });
  };
}

export function handleLogin(req, res) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  cleanOldAttempts();

  const attempts = failedAttempts.get(ip) || { count: 0, timestamp: Date.now() };
  if (attempts.count >= 5) {
    const remainingTime = Math.ceil((attempts.timestamp + 5 * 60 * 1000 - Date.now()) / 1000);
    if (remainingTime > 0) {
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Please wait ${remainingTime} seconds.`
      });
    } else {
      failedAttempts.delete(ip);
    }
  }

  const { username, password } = req.body;
  const cfg = loadConfig();

  const authResult = authenticateUser(username, password, cfg);

  if (!authResult.success) {
    attempts.count += 1;
    attempts.timestamp = Date.now();
    failedAttempts.set(ip, attempts);
    return res.status(401).json({
      success: false,
      error: authResult.error || 'Invalid credentials. Please try again.'
    });
  }

  failedAttempts.delete(ip);

  const { token, sessionId, payload } = generateToken(authResult.user, cfg);

  // Record connection session (Local vs Remote, device info, IP)
  recordSession(sessionId, payload.username, payload.role, req);

  const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
  const cookieOpts = {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: isHttps
  };
  res.cookie('cloud_token', token, cookieOpts);
  res.cookie('mac_token', token, cookieOpts);

  return res.json({
    success: true,
    token,
    user: {
      id: payload.id,
      name: payload.name || payload.username,
      username: payload.username,
      role: payload.role,
      permissions: payload.permissions
    },
    isFirstLogin: !cfg.isConfigured && payload.role === 'admin'
  });
}

export function handleLogout(req, res) {
  if (req.user?.sessionId) {
    revokeSession(req.user.sessionId);
  }
  res.clearCookie('cloud_token');
  res.clearCookie('mac_token');
  return res.json({ success: true });
}

export function handleAuthStatus(req, res) {
  const cfg = loadConfig();
  const token = req.cookies?.cloud_token || req.cookies?.mac_token || req.headers.authorization?.replace('Bearer ', '');
  const payload = verifyToken(token, cfg);
  if (payload && payload.sessionId && isSessionRevoked(payload.sessionId)) {
    res.clearCookie('cloud_token');
    res.clearCookie('mac_token');
    return res.status(401).json({
      authenticated: false,
      user: null,
      isConfigured: cfg.isConfigured,
      serverName: cfg.serverName,
      error: 'Session was disconnected by administrator.'
    });
  }
  if (payload && payload.role === 'guest') {
    const guests = loadGuests();
    const currentGuest = guests.find(g => g.username.toLowerCase() === payload.username.toLowerCase());
    if (currentGuest) {
      payload.name = currentGuest.name || currentGuest.username;
      if (currentGuest.permissions) {
        payload.permissions = currentGuest.permissions;
      }
      payload.id = currentGuest.id;
    }
  }
  return res.json({
    authenticated: !!payload,
    user: payload ? {
      id: payload.id,
      name: payload.name || payload.username,
      username: payload.username,
      role: payload.role,
      permissions: payload.permissions
    } : null,
    isConfigured: cfg.isConfigured,
    serverName: cfg.serverName
  });
}

export function handleChangePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long.' });
  }

  const cfg = loadConfig();
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Only admin can change master password here.' });
  }

  const authCheck = authenticateUser('admin', currentPassword || '', cfg);
  if (cfg.isConfigured && !authCheck.success) {
    return res.status(401).json({ success: false, error: 'Current admin password incorrect.' });
  }

  updatePassword(newPassword, cfg);
  const { token } = generateToken({ username: 'admin', role: 'admin', permissions: { canWrite: true, canDelete: true, canDownload: true } }, cfg);

  res.cookie('mac_token', token, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  return res.json({ success: true, message: 'Admin password updated successfully!', token });
}
