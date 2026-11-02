import fs from 'fs';
import path from 'path';
import os from 'os';
import mime from 'mime-types';

export function getAllowedGuestPaths(user) {
  const fa = user?.permissions?.folderAccess || {};
  const allowed = [];

  if (Array.isArray(fa.customFolders)) {
    for (const item of fa.customFolders) {
      const rawPath = typeof item === 'string' ? item : item?.path;
      if (rawPath && typeof rawPath === 'string' && rawPath.trim()) {
        const resolved = path.resolve(rawPath.trim());
        if (!allowed.includes(resolved)) {
          allowed.push(resolved);
        }
      }
    }
  }

  return allowed;
}

export function isPathAllowedForUser(targetPath, user) {
  if (!user || user.role === 'admin') return true;
  if (!targetPath) return false;
  const safe = path.resolve(targetPath);
  const allowed = getAllowedGuestPaths(user);
  if (allowed.length === 0) return false;
  return allowed.some(base => safe === base || safe.startsWith(base + path.sep));
}

export function getBookmarks(user = null) {
  const home = os.homedir();
  const isWin = process.platform === 'win32';

  // For Guests: only include custom folders explicitly granted by admin
  if (user && user.role === 'guest') {
    const fa = user.permissions?.folderAccess || {};
    const guestBookmarks = [];
    if (Array.isArray(fa.customFolders)) {
      for (const item of fa.customFolders) {
        const rawPath = typeof item === 'string' ? item : item?.path;
        if (rawPath && typeof rawPath === 'string' && rawPath.trim()) {
          const resolved = path.resolve(rawPath.trim());
          const folderName = (typeof item === 'object' && item.name) ? item.name : path.basename(resolved);
          if (!guestBookmarks.some(b => b.path === resolved)) {
            guestBookmarks.push({ name: folderName || 'Folder', path: resolved, icon: 'folder' });
          }
        }
      }
    }
    return guestBookmarks.filter(b => fs.existsSync(b.path));
  }

  // For Admin: full Quick Access to all directories
  const rootDrive = isWin ? (process.env.SystemDrive || 'C:') + '\\' : '/';
  const rootLabel = isWin ? `Local Disk (${rootDrive})` : 'Root (Macintosh HD)';

  const bookmarks = [
    { name: 'Home', path: home, icon: 'home' },
    { name: 'Desktop', path: path.join(home, 'Desktop'), icon: 'desktop' },
    { name: 'Documents', path: path.join(home, 'Documents'), icon: 'document' },
    { name: 'Downloads', path: path.join(home, 'Downloads'), icon: 'download' },
    { name: 'Pictures', path: path.join(home, 'Pictures'), icon: 'image' },
    { name: 'Music', path: path.join(home, 'Music'), icon: 'music' },
    { name: isWin ? 'Videos' : 'Movies', path: path.join(home, isWin ? 'Videos' : 'Movies'), icon: 'video' },
    { name: rootLabel, path: rootDrive, icon: 'server' }
  ];
  return bookmarks.filter(b => fs.existsSync(b.path));
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const SKIPPED_DIRS = new Set([
  'Library',
  'node_modules',
  '.git',
  '.Trash',
  'System',
  'Applications',
  '$RECYCLE.BIN',
  'System Volume Information'
]);

const folderSizeCache = new Map();

// Calculate directory size and file count safely with strict scanning limit
export async function getDirectorySize(dirPath, maxDepth = 2, maxTimeoutMs = 80, mtimeMs = null) {
  const cached = folderSizeCache.get(dirPath);
  if (cached && (Date.now() - cached.timestamp < 60000)) {
    if (mtimeMs === null || cached.mtimeMs === mtimeMs) {
      return cached;
    }
  }

  let totalBytes = 0;
  let fileCount = 0;
  let folderCount = 0;
  let scanned = 0;
  const maxScanned = 1500;
  const startTime = Date.now();

  async function walk(currentPath, depth) {
    if (depth > maxDepth || scanned >= maxScanned || (Date.now() - startTime) > maxTimeoutMs) return;
    try {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (scanned >= maxScanned || (Date.now() - startTime) > maxTimeoutMs) break;
        if (entry.name.startsWith('.')) continue;
        if (SKIPPED_DIRS.has(entry.name)) continue;
        const full = path.join(currentPath, entry.name);
        try {
          if (entry.isDirectory()) {
            folderCount++;
            scanned++;
            await walk(full, depth + 1);
          } else if (entry.isFile()) {
            const st = await fs.promises.stat(full);
            totalBytes += st.size;
            fileCount++;
            scanned++;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  const baseName = path.basename(dirPath);
  if (!SKIPPED_DIRS.has(baseName)) {
    await walk(dirPath, 0);
  }

  const result = {
    totalBytes,
    fileCount,
    folderCount,
    formatted: formatBytes(totalBytes),
    mtimeMs: mtimeMs || null,
    timestamp: Date.now()
  };

  folderSizeCache.set(dirPath, result);
  return result;
}

export async function listDirectory(targetPath, showHidden = false, user = null) {
  let safePath = targetPath ? path.resolve(targetPath) : null;
  const home = os.homedir();
  const isGuest = user && user.role === 'guest';
  let guestAllowedBases = [];
  let currentGuestBase = null;

  if (isGuest) {
    guestAllowedBases = getAllowedGuestPaths(user);
    if (guestAllowedBases.length === 0) {
      throw new Error('Access denied. No folder permissions have been granted to your guest account. Please contact the administrator.');
    }

    // If safePath is not given, or not permitted, default to first allowed folder
    if (!safePath || !isPathAllowedForUser(safePath, user)) {
      safePath = guestAllowedBases[0];
    }

    currentGuestBase = guestAllowedBases.find(b => safePath === b || safePath.startsWith(b + path.sep));
  } else {
    if (!safePath) {
      safePath = home;
    }
  }

  if (!fs.existsSync(safePath)) {
    throw new Error('Directory does not exist');
  }

  const stat = await fs.promises.stat(safePath);
  if (!stat.isDirectory()) {
    throw new Error('Specified path is not a directory');
  }

  const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
  let currentTotalBytes = 0;

  const dirEntries = [];
  const fileEntries = [];

  for (const entry of entries) {
    if (!showHidden && entry.name.startsWith('.')) {
      continue;
    }
    const itemPath = path.join(safePath, entry.name);
    try {
      const itemStat = await fs.promises.stat(itemPath);
      if (entry.isDirectory()) {
        dirEntries.push({ entry, itemPath, itemStat });
      } else {
        fileEntries.push({ entry, itemPath, itemStat });
      }
    } catch (err) {}
  }

  // Process directories with safe size and item count calculation
  const dirItems = await Promise.all(dirEntries.map(async ({ entry, itemPath, itemStat }) => {
    let itemCount = 0;
    try {
      const subEntries = await fs.promises.readdir(itemPath);
      itemCount = subEntries.filter(e => showHidden || !e.startsWith('.')).length;
    } catch (e) {
      itemCount = 0;
    }

    let dirInfo;
    try {
      dirInfo = await getDirectorySize(itemPath, 2, 80, itemStat.mtimeMs);
    } catch (e) {
      dirInfo = { totalBytes: 0, fileCount: 0, formatted: '0 B' };
    }

    const dirSize = dirInfo.totalBytes || 0;
    currentTotalBytes += dirSize;

    return {
      name: entry.name,
      path: itemPath,
      isDirectory: true,
      size: dirSize,
      sizeFormatted: formatBytes(dirSize),
      itemCount,
      mtime: itemStat.mtime.toISOString(),
      mime: 'folder',
      extension: '',
      isHidden: entry.name.startsWith('.')
    };
  }));

  // Process files
  const fileItems = fileEntries.map(({ entry, itemPath, itemStat }) => {
    currentTotalBytes += itemStat.size;
    return {
      name: entry.name,
      path: itemPath,
      isDirectory: false,
      size: itemStat.size,
      sizeFormatted: formatBytes(itemStat.size),
      itemCount: 0,
      mtime: itemStat.mtime.toISOString(),
      mime: mime.lookup(itemPath) || 'application/octet-stream',
      extension: path.extname(entry.name).toLowerCase(),
      isHidden: entry.name.startsWith('.')
    };
  });

  const items = [...dirItems, ...fileItems];
  const currentFolderCount = dirEntries.length;
  const currentFileCount = fileEntries.length;

  // Sort: directories first, then alphabetically
  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Calculate breadcrumbs
  const breadcrumbs = [];
  if (isGuest && currentGuestBase) {
    const baseName = path.basename(currentGuestBase);
    breadcrumbs.push({ name: baseName, path: currentGuestBase });

    if (safePath !== currentGuestBase) {
      const rel = path.relative(currentGuestBase, safePath);
      const parts = rel.split(path.sep).filter(Boolean);
      let cur = currentGuestBase;
      for (const p of parts) {
        cur = path.join(cur, p);
        breadcrumbs.push({ name: p, path: cur });
      }
    }
  } else {
    const parts = safePath.split(path.sep);
    let currentAcc = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === 0 && part === '') {
        currentAcc = '/';
        breadcrumbs.push({ name: 'Root', path: '/' });
      } else if (i === 0 && /^[a-zA-Z]:$/.test(part)) {
        currentAcc = part + path.sep;
        breadcrumbs.push({ name: part, path: currentAcc });
      } else if (part) {
        currentAcc = currentAcc ? path.join(currentAcc, part) : part;
        breadcrumbs.push({ name: part, path: currentAcc });
      }
    }
  }

  let parentPath = null;
  if (isGuest && currentGuestBase) {
    parentPath = safePath === currentGuestBase ? null : path.dirname(safePath);
  } else {
    parentPath = path.dirname(safePath) === safePath ? null : path.dirname(safePath);
  }

  return {
    currentPath: safePath,
    parentPath,
    breadcrumbs,
    items,
    bookmarks: getBookmarks(user),
    folderStats: {
      totalFiles: currentFileCount,
      totalFolders: currentFolderCount,
      totalItems: currentFileCount + currentFolderCount,
      totalBytes: currentTotalBytes,
      totalFormatted: formatBytes(currentTotalBytes),
      summary: `${currentFileCount + currentFolderCount} items (${formatBytes(currentTotalBytes)})`
    }
  };
}

export async function readTextFile(filePath, user = null) {
  const safePath = path.resolve(filePath);
  if (!isPathAllowedForUser(safePath, user)) {
    throw new Error('Access denied. You do not have permission to view this file.');
  }
  const stat = await fs.promises.stat(safePath);
  
  if (stat.size > 15 * 1024 * 1024) {
    throw new Error('File is too large to open in browser editor (>15MB). Please download it instead.');
  }

  const content = await fs.promises.readFile(safePath, 'utf-8');
  return {
    path: safePath,
    name: path.basename(safePath),
    size: stat.size,
    content,
    mime: mime.lookup(safePath) || 'text/plain'
  };
}

export async function writeTextFile(filePath, content, user = null) {
  const safePath = path.resolve(filePath);
  if (!isPathAllowedForUser(safePath, user)) {
    throw new Error('Access denied. You do not have permission to modify files in this directory.');
  }
  await fs.promises.writeFile(safePath, content, 'utf-8');
  return { success: true, path: safePath };
}

export async function createDirectory(dirPath, user = null) {
  const safePath = path.resolve(dirPath);
  if (!isPathAllowedForUser(safePath, user)) {
    throw new Error('Access denied. You do not have permission to create folders here.');
  }
  await fs.promises.mkdir(safePath, { recursive: true });
  return { success: true, path: safePath };
}

export async function createFile(filePath, user = null) {
  const safePath = path.resolve(filePath);
  if (!isPathAllowedForUser(safePath, user)) {
    throw new Error('Access denied. You do not have permission to create files here.');
  }
  if (fs.existsSync(safePath)) {
    throw new Error('File already exists');
  }
  await fs.promises.writeFile(safePath, '', 'utf-8');
  return { success: true, path: safePath };
}

export async function renameItem(oldPath, newName, user = null) {
  const safeOld = path.resolve(oldPath);
  if (!isPathAllowedForUser(safeOld, user)) {
    throw new Error('Access denied. You do not have permission to rename items here.');
  }
  const dir = path.dirname(safeOld);
  const safeNew = path.join(dir, newName);
  if (!isPathAllowedForUser(safeNew, user)) {
    throw new Error('Access denied. Target name is outside permitted directory.');
  }

  if (fs.existsSync(safeNew)) {
    throw new Error('An item with that name already exists');
  }

  await fs.promises.rename(safeOld, safeNew);
  return { success: true, oldPath: safeOld, newPath: safeNew };
}

export async function deleteItem(targetPath, permanent = false, user = null) {
  const safePath = path.resolve(targetPath);
  if (!isPathAllowedForUser(safePath, user)) {
    throw new Error('Access denied. You do not have permission to delete items from this directory.');
  }
  if (!fs.existsSync(safePath)) {
    throw new Error('Item does not exist');
  }

  const isWin = process.platform === 'win32';
  const protectedPaths = isWin
    ? [
        (process.env.SystemDrive || 'C:') + '\\',
        path.join(process.env.SystemDrive || 'C:\\', 'Windows'),
        path.join(process.env.SystemDrive || 'C:\\', 'Program Files'),
        path.join(process.env.SystemDrive || 'C:\\', 'Program Files (x86)'),
        os.homedir()
      ].map(p => path.resolve(p).toLowerCase())
    : ['/', '/System', '/Library', '/bin', '/sbin', '/usr', os.homedir()].map(p => path.resolve(p));

  const checkPath = isWin ? safePath.toLowerCase() : safePath;
  if (protectedPaths.includes(checkPath)) {
    throw new Error('Cannot delete protected system or home directory');
  }

  if (!permanent) {
    const trashDir = path.join(os.homedir(), '.Trash');
    if (fs.existsSync(trashDir)) {
      try {
        let dest = path.join(trashDir, path.basename(safePath));
        if (fs.existsSync(dest)) {
          dest = path.join(trashDir, `${Date.now()}_${path.basename(safePath)}`);
        }
        await fs.promises.rename(safePath, dest);
        return { success: true, trashed: true, path: safePath };
      } catch (err) {}
    }
  }

  await fs.promises.rm(safePath, { recursive: true, force: true });
  return { success: true, trashed: false, path: safePath };
}

export async function searchInDirectory(targetDir, query, maxResults = 50, user = null) {
  let safeDir = targetDir ? path.resolve(targetDir) : null;
  if (!safeDir) {
    if (user && user.role === 'guest') {
      const allowed = getAllowedGuestPaths(user);
      safeDir = allowed[0] || null;
    } else {
      safeDir = os.homedir();
    }
  }
  if (!safeDir || !isPathAllowedForUser(safeDir, user)) {
    throw new Error('Access denied. You do not have permission to search in this directory.');
  }
  const results = [];
  const q = query.toLowerCase();

  async function walk(dir, depth = 0) {
    if (depth > 4 || results.length >= maxResults) return;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (SKIPPED_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);

        if (entry.name.toLowerCase().includes(q)) {
          const isDir = entry.isDirectory();
          results.push({
            name: entry.name,
            path: fullPath,
            isDirectory: isDir,
            mime: isDir ? 'folder' : (mime.lookup(fullPath) || 'application/octet-stream')
          });
        }

        if (entry.isDirectory() && results.length < maxResults) {
          await walk(fullPath, depth + 1);
        }
      }
    } catch (e) {}
  }

  await walk(safeDir);
  return results;
}
