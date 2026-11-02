// Auth Token interceptor for seamless remote & local access
const originalFetch = window.fetch;
window.fetch = function(input, init = {}) {
  const token = localStorage.getItem('cloud_token');
  if (token) {
    init = init || {};
    init.headers = init.headers || {};
    if (init.headers instanceof Headers) {
      if (!init.headers.has('Authorization')) {
        init.headers.set('Authorization', `Bearer ${token}`);
      }
    } else if (Array.isArray(init.headers)) {
      if (!init.headers.some(([k]) => k.toLowerCase() === 'authorization')) {
        init.headers.push(['Authorization', `Bearer ${token}`]);
      }
    } else {
      if (!init.headers['Authorization'] && !init.headers['authorization']) {
        init.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }
  return originalFetch.call(this, input, init);
};

function getAuthTokenQuery() {
  const token = localStorage.getItem('cloud_token');
  return token ? `&auth_token=${encodeURIComponent(token)}` : '';
}

// Universal clipboard helper with multiple fallback layers
async function copyTextToClipboard(text, successMessage = 'Copied to clipboard!') {
  if (!text || text === '#' || text === '...') {
    showToast('Link is not available to copy');
    return false;
  }

  let success = false;

  // 1. Try modern Clipboard API
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch (e) {
      success = false;
    }
  }

  // 2. Fallback using temporary textarea
  if (!success) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (e) {
      success = false;
    }
  }

  // 3. Prompt fallback if both automated clipboard methods are blocked by the browser
  if (!success) {
    try {
      window.prompt('Copy link:', text);
      success = true;
    } catch (e) {
      success = false;
    }
  }

  if (success) {
    showToast(successMessage);
  } else {
    showToast('Failed to copy link');
  }

  return success;
}

// State
let currentPath = '';
let currentItems = [];
let currentUser = null;
let viewMode = localStorage.getItem('mac_view_mode') || 'grid';
let showHidden = localStorage.getItem('mac_show_hidden') === 'true';
let sortBy = 'name';
let currentEditingPath = '';
let promptAction = null;
let currentLocalUrl = '';
let currentTunnelUrl = '';
let activeSheetItem = null;

// DOM Elements
const breadcrumbsBar = document.getElementById('breadcrumbsBar');
const bookmarksNav = document.getElementById('bookmarksNav');
const fileGrid = document.getElementById('fileGrid');
const fileTable = document.getElementById('fileTable');
const fileTableBody = document.getElementById('fileTableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const viewToggleBtn = document.getElementById('viewToggleBtn');
const hiddenFilesBtn = document.getElementById('hiddenFilesBtn');
const downloadFolderBtn = document.getElementById('downloadFolderBtn');

const uploadBtn = document.getElementById('uploadBtn');
const fileUploadInput = document.getElementById('fileUploadInput');
const dropzoneOverlay = document.getElementById('dropzoneOverlay');
const uploadStatus = document.getElementById('uploadStatus');
const uploadProgressFill = document.getElementById('uploadProgressFill');
const uploadText = document.getElementById('uploadText');

const headerServerName = document.getElementById('headerServerName');
const tunnelBadge = document.getElementById('tunnelBadge');
const tunnelStatusText = document.getElementById('tunnelStatusText');
const batteryBadge = document.getElementById('batteryBadge');
const batteryText = document.getElementById('batteryText');
const storageStats = document.getElementById('storageStats');
const storageBarFill = document.getElementById('storageBarFill');
const folderStatsPill = document.getElementById('folderStatsPill');
const copyCurrentPathBtn = document.getElementById('copyCurrentPathBtn');

// Notifications Modal Elements
const notifModal = document.getElementById('notifModal');
const notifBtn = document.getElementById('notifBtn');
const notifCloseBtn = document.getElementById('notifCloseBtn');
const notifBadgeCount = document.getElementById('notifBadgeCount');
const notifTabAllBtn = document.getElementById('notifTabAllBtn');
const notifTabDownloadsBtn = document.getElementById('notifTabDownloadsBtn');
const notifTabReqBtn = document.getElementById('notifTabReqBtn');
const notifAllCountPill = document.getElementById('notifAllCountPill');
const notifDownloadsCountPill = document.getElementById('notifDownloadsCountPill');
const notifReqCountPill = document.getElementById('notifReqCountPill');
const unifiedNotifList = document.getElementById('unifiedNotifList');
const markAllNotifsReadBtn = document.getElementById('markAllNotifsReadBtn');

// Dedicated Messages & Chat Modal Elements
const messagesModal = document.getElementById('messagesModal');
const messagesBtn = document.getElementById('messagesBtn');
const messagesCloseBtn = document.getElementById('messagesCloseBtn');
const messagesBadgeCount = document.getElementById('messagesBadgeCount');
const markAllMessagesReadBtn = document.getElementById('markAllMessagesReadBtn');
const chatConversationFilter = document.getElementById('chatConversationFilter');
const chatMessagesList = document.getElementById('chatMessagesList');
const chatSendMessageForm = document.getElementById('chatSendMessageForm');
const chatRecipientSelect = document.getElementById('chatRecipientSelect');
const chatMessageInput = document.getElementById('chatMessageInput');

// Settings Profile Elements
const adminProfileForm = document.getElementById('adminProfileForm');
const adminProfileName = document.getElementById('adminProfileName');
const adminProfileUsername = document.getElementById('adminProfileUsername');
const adminCurrentPass = document.getElementById('adminCurrentPass');
const adminNewPass = document.getElementById('adminNewPass');
const guestProfileForm = document.getElementById('guestProfileForm');
const guestProfileName = document.getElementById('guestProfileName');
const guestProfileUsername = document.getElementById('guestProfileUsername');
const guestProfileNewPass = document.getElementById('guestProfileNewPass');
const guestProfileConfirmPass = document.getElementById('guestProfileConfirmPass');

// Unified Settings Modal Elements
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const settingsConnCount = document.getElementById('settingsConnCount');

// Settings: General & LAN
const serverNameForm = document.getElementById('serverNameForm');
const serverNameInput = document.getElementById('serverNameInput');
const settingsLocalUrl = document.getElementById('settingsLocalUrl');
const copyLocalUrlBtn = document.getElementById('copyLocalUrlBtn');
const settingsLocalQrImg = document.getElementById('settingsLocalQrImg');

// Settings: Remote Access
const remoteSwitchCheckbox = document.getElementById('remoteSwitchCheckbox');
const remoteStatusBadge = document.getElementById('remoteStatusBadge');
const remoteStatusExplanation = document.getElementById('remoteStatusExplanation');
const remoteActiveSection = document.getElementById('remoteActiveSection');
const remoteInactiveSection = document.getElementById('remoteInactiveSection');
const remoteModalLink = document.getElementById('remoteModalLink');
const copyRemoteUrlBtn = document.getElementById('copyRemoteUrlBtn');
const remoteModalQrImg = document.getElementById('remoteModalQrImg');

// Settings: Connected Sessions
const tabActiveBtn = document.getElementById('tabActiveBtn');
const tabHistoryBtn = document.getElementById('tabHistoryBtn');
const tabActiveContent = document.getElementById('tabActiveContent');
const tabHistoryContent = document.getElementById('tabHistoryContent');
const activeConnectionsList = document.getElementById('activeConnectionsList');
const historyConnectionsList = document.getElementById('historyConnectionsList');

// Settings: Guest Users
const createGuestForm = document.getElementById('createGuestForm');
const guestsList = document.getElementById('guestsList');

// Settings: Master Password
const changePasswordForm = document.getElementById('changePasswordForm');
const settingsMsg = document.getElementById('settingsMsg');

const editorModal = document.getElementById('editorModal');
const editorFileName = document.getElementById('editorFileName');
const editorTextarea = document.getElementById('editorTextarea');
const editorSaveBtn = document.getElementById('editorSaveBtn');
const editorCloseBtn = document.getElementById('editorCloseBtn');

const previewModal = document.getElementById('previewModal');
const previewTitle = document.getElementById('previewTitle');
const previewContent = document.getElementById('previewContent');
const previewDownloadBtn = document.getElementById('previewDownloadBtn');
const previewCloseBtn = document.getElementById('previewCloseBtn');

const promptModal = document.getElementById('promptModal');
const promptTitle = document.getElementById('promptTitle');
const promptInput = document.getElementById('promptInput');
const promptForm = document.getElementById('promptForm');
const promptCancelBtn = document.getElementById('promptCancelBtn');
const promptCloseBtn = document.getElementById('promptCloseBtn');


const logoutBtn = document.getElementById('logoutBtn');
const menuToggleBtn = document.getElementById('menuToggleBtn');
const appSidebar = document.getElementById('appSidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarUserDisplay = document.getElementById('sidebarUserDisplay');
const sidebarUserRole = document.getElementById('sidebarUserRole');
const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
const toastContainer = document.getElementById('toastContainer');

const mobileUploadBtn = document.getElementById('mobileUploadBtn');
const mobileNewFolderBtn = document.getElementById('mobileNewFolderBtn');
const mobileNewFileBtn = document.getElementById('mobileNewFileBtn');
const mobileQrBtn = document.getElementById('mobileQrBtn');

const itemActionModal = document.getElementById('itemActionModal');
const actionSheetItemName = document.getElementById('actionSheetItemName');
const actionSheetCloseBtn = document.getElementById('actionSheetCloseBtn');
const sheetOpenBtn = document.getElementById('sheetOpenBtn');
const sheetOpenLabel = document.getElementById('sheetOpenLabel');
const sheetDownloadBtn = document.getElementById('sheetDownloadBtn');
const sheetDownloadLabel = document.getElementById('sheetDownloadLabel');
const sheetRenameBtn = document.getElementById('sheetRenameBtn');
const sheetDeleteBtn = document.getElementById('sheetDeleteBtn');

// Modern SVG Icons
const SVG_ICONS = {
  folder: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
  image: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
  video: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>',
  audio: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  code: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  document: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
  pdf: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
  archive: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect width="22" height="5" x="1" y="3" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  binary: '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>',
  dots: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  download: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  rename: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>'
};

const BOOKMARK_ICONS = {
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  desktop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
  document: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>',
  download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
  image: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>',
  music: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
  video: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect></svg>',
  server: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>'
};

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function formatDate(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes) {
  if (bytes === 0 || bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return '0 B';
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i] || 'B'}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFileSvg(item) {
  if (item.isDirectory) return SVG_ICONS.folder;
  const ext = (item.extension || '').toLowerCase();
  const mime = (item.mime || '').toLowerCase();

  if (mime.startsWith('image/')) return SVG_ICONS.image;
  if (mime.startsWith('video/')) return SVG_ICONS.video;
  if (mime.startsWith('audio/')) return SVG_ICONS.audio;
  if (mime.includes('pdf') || ext === '.pdf') return SVG_ICONS.pdf;
  if (['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.dmg'].includes(ext)) return SVG_ICONS.archive;
  if (['.js', '.mjs', '.ts', '.py', '.html', '.css', '.json', '.sh', '.c', '.cpp', '.rs', '.go', '.sql'].includes(ext)) return SVG_ICONS.code;
  if (['.txt', '.md', '.log', '.csv', '.env', '.yaml', '.yml'].includes(ext)) return SVG_ICONS.document;
  if (['.app', '.pkg', '.bin', '.exe'].includes(ext)) return SVG_ICONS.binary;
  return SVG_ICONS.document;
}

function isTextEditable(item) {
  if (item.isDirectory) return false;
  const ext = (item.extension || '').toLowerCase();
  const mime = (item.mime || '').toLowerCase();
  const textExts = ['.txt', '.md', '.json', '.js', '.mjs', '.ts', '.html', '.css', '.py', '.sh', '.yaml', '.yml', '.env', '.xml', '.sql', '.csv', '.log', '.ini', '.conf'];
  return mime.startsWith('text/') || textExts.includes(ext);
}

function isMedia(item) {
  if (item.isDirectory) return false;
  const mime = (item.mime || '').toLowerCase();
  const ext = (item.extension || '').toLowerCase();
  return mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || ext === '.pdf';
}

// Helper to update User Profile details in the UI
function updateUserProfileDisplay(user) {
  if (!user) return;
  const disp = document.getElementById('sidebarUserDisplay');
  const role = document.getElementById('sidebarUserRole');
  const avatar = document.getElementById('sidebarUserAvatar');
  if (disp) {
    disp.textContent = user.name || user.username || 'User';
  }
  if (role) {
    role.textContent = user.role === 'admin' ? 'Administrator' : `@${user.username}`;
  }
  if (avatar) {
    const initial = (user.name || user.username || 'U')[0].toUpperCase();
    avatar.textContent = initial;
  }
}

// Apply User Role Permissions to UI
function applyUserPermissions(user) {
  currentUser = user;
  updateUserProfileDisplay(user);
  const isAdmin = user?.role === 'admin';
  const perms = user?.permissions || {};

  // Admin-only elements
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  // Guest-only elements
  document.querySelectorAll('.guest-only').forEach(el => {
    el.style.display = !isAdmin ? '' : 'none';
  });

  // Write permissions (upload, new folder, new file, edit save)
  const canWrite = isAdmin || perms.canWrite;
  document.querySelectorAll('.write-only').forEach(el => {
    el.style.display = canWrite ? '' : 'none';
  });

  // Delete permissions
  const canDelete = isAdmin || perms.canDelete;
  document.querySelectorAll('.delete-only').forEach(el => {
    el.style.display = canDelete ? '' : 'none';
  });

  // Download permissions
  const canDownload = isAdmin || perms.canDownload;
  document.querySelectorAll('.download-only').forEach(el => {
    el.style.display = canDownload ? '' : 'none';
  });
}

// Check Auth Status on Page Load
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/status');
    if (res.status === 401) {
      localStorage.removeItem('cloud_token');
      window.location.href = '/login.html';
      return false;
    }
    const data = await res.json();
    if (data.serverName) {
      if (headerServerName) headerServerName.textContent = data.serverName;
      if (serverNameInput) serverNameInput.value = data.serverName;
      document.title = `${data.serverName} — Personal Cloud`;
    }
    if (data.authenticated && data.user) {
      applyUserPermissions(data.user);
      return true;
    } else {
      window.location.href = '/login.html';
      return false;
    }
  } catch (err) {
    console.error('Check auth error:', err);
  }
  return false;
}

// Load Directory
async function loadDirectory(path = '') {
  try {
    const query = new URLSearchParams({ path, showHidden: showHidden.toString() });
    const res = await fetch(`/api/files/browse?${query}`);
    
    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }

    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Failed to load directory');
      return;
    }

    if (data.user) {
      applyUserPermissions(data.user);
    }

    if (folderStatsPill) {
      if (data.folderStats && data.folderStats.summary) {
        folderStatsPill.textContent = data.folderStats.summary;
        folderStatsPill.style.display = 'inline-flex';
      } else {
        folderStatsPill.style.display = 'none';
      }
    }

    currentPath = data.currentPath;
    currentItems = data.items;

    renderBreadcrumbs(data.breadcrumbs);
    renderBookmarks(data.bookmarks);
    renderItems(currentItems);
  } catch (err) {
    showToast('Server connection error: ' + err.message);
  }
}


// Render Breadcrumbs
function renderBreadcrumbs(crumbs) {
  breadcrumbsBar.innerHTML = '';
  crumbs.forEach((crumb, index) => {
    if (index > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '/';
      breadcrumbsBar.appendChild(sep);
    }
    const item = document.createElement('span');
    item.className = `breadcrumb-item ${index === crumbs.length - 1 ? 'active' : ''}`;
    item.textContent = crumb.name;
    item.title = crumb.path;
    item.onclick = () => loadDirectory(crumb.path);
    breadcrumbsBar.appendChild(item);
  });
  breadcrumbsBar.scrollLeft = breadcrumbsBar.scrollWidth;
}

// Render Bookmarks
function renderBookmarks(bookmarks) {
  if (!bookmarks) return;
  bookmarksNav.innerHTML = '';
  bookmarks.forEach(b => {
    const item = document.createElement('div');
    const isActive = currentPath === b.path;
    item.className = `sidebar-nav-item ${isActive ? 'active' : ''}`;
    const iconSvg = BOOKMARK_ICONS[b.icon] || BOOKMARK_ICONS.document;
    item.innerHTML = `<span class="nav-icon">${iconSvg}</span><span>${b.name}</span>`;
    item.onclick = () => {
      loadDirectory(b.path);
      closeMobileSidebar();
    };
    bookmarksNav.appendChild(item);
  });
}

function closeMobileSidebar() {
  appSidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('active');
}

// Sort Items
function sortItems(items) {
  const sorted = [...items];
  if (sortBy === 'name') {
    sorted.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  } else if (sortBy === 'size') {
    sorted.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return b.size - a.size;
    });
  } else if (sortBy === 'date') {
    sorted.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  }
  return sorted;
}

// Render Files
function renderItems(items) {
  const sorted = sortItems(items);
  
  if (sorted.length === 0) {
    emptyState.style.display = 'flex';
    fileGrid.style.display = 'none';
    fileTable.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';

  if (viewMode === 'grid') {
    fileGrid.style.display = 'grid';
    fileTable.style.display = 'none';
    renderGridView(sorted);
  } else {
    fileGrid.style.display = 'none';
    fileTable.style.display = 'table';
    renderTableView(sorted);
  }
}

function renderGridView(items) {
  fileGrid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'grid-item';

    const iconSvg = getFileSvg(item);
    const iconClass = item.isDirectory ? 'item-icon-wrapper folder-icon' : 'item-icon-wrapper';

    let sizeText = item.sizeFormatted || '0 B';
    if (item.isDirectory) {
      const count = item.itemCount || 0;
      const countLabel = `${count} item${count === 1 ? '' : 's'}`;
      const sizeLabel = item.sizeFormatted || '0 B';
      sizeText = `${sizeLabel} • ${countLabel}`;
      card.title = `${item.name} (Folder, ${sizeLabel}, ${countLabel})`;
    } else {
      card.title = `${item.name} (${item.sizeFormatted || '0 B'})`;
    }

    card.innerHTML = `
      <button class="grid-item-menu-btn" title="Options" aria-label="Item options">
        ${SVG_ICONS.dots}
      </button>
      <div class="${iconClass}">${iconSvg}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-size">${sizeText}</div>
    `;

    card.onclick = (e) => {
      if (e.target.closest('.grid-item-menu-btn')) return;
      handleItemClick(item);
    };

    const menuBtn = card.querySelector('.grid-item-menu-btn');
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      openItemActionSheet(item);
    };

    fileGrid.appendChild(card);
  });
}

function renderTableView(items) {
  fileTableBody.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('tr');
    const iconSvg = getFileSvg(item);
    const canWrite = currentUser?.role === 'admin' || currentUser?.permissions?.canWrite;
    const canDelete = currentUser?.role === 'admin' || currentUser?.permissions?.canDelete;
    const canDownload = currentUser?.role === 'admin' || currentUser?.permissions?.canDownload;

    let tableSize = item.sizeFormatted || '0 B';
    if (item.isDirectory) {
      const count = item.itemCount || 0;
      const countLabel = `${count} item${count === 1 ? '' : 's'}`;
      const sizeLabel = item.sizeFormatted || '0 B';
      tableSize = `${sizeLabel} (${countLabel})`;
    }

    row.innerHTML = `
      <td>
        <div class="name-col">
          <span class="table-icon">${iconSvg}</span>
          <span>${item.name}</span>
        </div>
      </td>
      <td>${tableSize}</td>
      <td>${formatDate(item.mtime)}</td>
      <td class="actions-col">
        ${canDownload ? `<button class="icon-btn-ghost download-btn" title="Download">${SVG_ICONS.download}</button>` : ''}
        ${canWrite ? `<button class="icon-btn-ghost rename-btn" title="Rename">${SVG_ICONS.rename}</button>` : ''}
        ${canDelete ? `<button class="icon-btn-ghost delete-btn" title="Move to Trash">${SVG_ICONS.trash}</button>` : ''}
      </td>
    `;

    row.querySelector('.name-col').onclick = () => handleItemClick(item);
    const dBtn = row.querySelector('.download-btn');
    if (dBtn) dBtn.onclick = (e) => { e.stopPropagation(); downloadItem(item); };
    const rBtn = row.querySelector('.rename-btn');
    if (rBtn) rBtn.onclick = (e) => { e.stopPropagation(); promptRename(item); };
    const delBtn = row.querySelector('.delete-btn');
    if (delBtn) delBtn.onclick = (e) => { e.stopPropagation(); confirmDelete(item); };

    fileTableBody.appendChild(row);
  });
}

// Action click
function handleItemClick(item) {
  if (item.isDirectory) {
    loadDirectory(item.path);
    return;
  }

  if (isTextEditable(item)) {
    openCodeEditor(item);
  } else if (isMedia(item)) {
    openMediaPreview(item);
  } else {
    downloadItem(item);
  }
}

// Mobile & Tablet Action Bottom Sheet
function openItemActionSheet(item) {
  activeSheetItem = item;
  if (item.isDirectory) {
    const count = item.itemCount || 0;
    const countLabel = `${count} item${count === 1 ? '' : 's'}`;
    const sizeLabel = item.sizeFormatted || '0 B';
    const headerTitle = `${item.name} (${sizeLabel}, ${countLabel})`;
    actionSheetItemName.textContent = headerTitle;
    actionSheetItemName.title = headerTitle;
    sheetOpenLabel.textContent = 'Open Folder';
    sheetDownloadLabel.textContent = 'Download Folder as ZIP';
  } else {
    actionSheetItemName.textContent = `${item.name} (${item.sizeFormatted || '0 B'})`;
    actionSheetItemName.title = `${item.name} (${item.sizeFormatted || '0 B'})`;
    if (isTextEditable(item)) {
      sheetOpenLabel.textContent = 'Edit in Code Editor';
    } else if (isMedia(item)) {
      sheetOpenLabel.textContent = 'Preview Media';
    } else {
      sheetOpenLabel.textContent = 'Download File';
    }
    sheetDownloadLabel.textContent = 'Download File';
  }

  itemActionModal.classList.add('active');
}

function closeItemActionSheet() {
  itemActionModal.classList.remove('active');
  activeSheetItem = null;
}

sheetOpenBtn.onclick = () => {
  if (!activeSheetItem) return;
  const item = activeSheetItem;
  closeItemActionSheet();
  handleItemClick(item);
};

sheetDownloadBtn.onclick = () => {
  if (!activeSheetItem) return;
  const item = activeSheetItem;
  closeItemActionSheet();
  downloadItem(item);
};

sheetRenameBtn.onclick = () => {
  if (!activeSheetItem) return;
  const item = activeSheetItem;
  closeItemActionSheet();
  promptRename(item);
};

sheetDeleteBtn.onclick = () => {
  if (!activeSheetItem) return;
  const item = activeSheetItem;
  closeItemActionSheet();
  confirmDelete(item);
};

actionSheetCloseBtn.onclick = closeItemActionSheet;

// Downloads
function downloadItem(item) {
  if (currentUser?.role === 'guest' && !currentUser.permissions.canDownload) {
    showToast('Download permission not granted');
    return;
  }
  const url = `/api/files/download?path=${encodeURIComponent(item.path)}${getAuthTokenQuery()}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = item.name + (item.isDirectory ? '.zip' : '');
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast(`Downloading: ${item.name}`);
}

// Code Editor
async function openCodeEditor(item) {
  try {
    currentEditingPath = item.path;
    editorFileName.textContent = item.name;
    editorTextarea.value = 'Loading contents...';
    editorModal.classList.add('active');

    const res = await fetch(`/api/files/read?path=${encodeURIComponent(item.path)}`);
    const data = await res.json();
    if (data.success) {
      editorTextarea.value = data.content;
      editorTextarea.focus();
    } else {
      showToast(data.error || 'Failed to read file');
      editorModal.classList.remove('active');
    }
  } catch (err) {
    showToast('Read error: ' + err.message);
    editorModal.classList.remove('active');
  }
}

async function saveCurrentFile() {
  if (!currentEditingPath) return;
  try {
    editorSaveBtn.disabled = true;
    editorSaveBtn.querySelector('span').textContent = 'Saving...';

    const res = await fetch('/api/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: currentEditingPath,
        content: editorTextarea.value
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast('File saved successfully');
      loadDirectory(currentPath);
    } else {
      showToast(data.error || 'Save failed');
    }
  } catch (err) {
    showToast('Save error: ' + err.message);
  } finally {
    editorSaveBtn.disabled = false;
    editorSaveBtn.querySelector('span').textContent = 'Save (Cmd+S)';
  }
}

// Media Preview
function openMediaPreview(item) {
  previewTitle.textContent = item.name;
  previewDownloadBtn.href = `/api/files/download?path=${encodeURIComponent(item.path)}${getAuthTokenQuery()}`;
  previewDownloadBtn.download = item.name;
  previewContent.innerHTML = '';

  const streamUrl = `/api/files/stream?path=${encodeURIComponent(item.path)}${getAuthTokenQuery()}`;
  const mime = (item.mime || '').toLowerCase();
  const ext = (item.extension || '').toLowerCase();

  if (mime.startsWith('image/')) {
    const img = document.createElement('img');
    img.className = 'preview-image';
    img.src = streamUrl;
    img.alt = item.name;
    previewContent.appendChild(img);
  } else if (mime.startsWith('video/') || ['.mkv', '.avi', '.wmv', '.flv', '.ts', '.mp4', '.mov', '.webm', '.m4v'].includes(ext)) {
    const video = document.createElement('video');
    video.className = 'preview-video';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.volume = 1.0;
    video.muted = false;
    video.src = streamUrl;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }

    previewContent.appendChild(video);
  } else if (mime.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.className = 'preview-audio';
    audio.controls = true;
    audio.autoplay = true;
    audio.volume = 1.0;
    audio.src = streamUrl;
    previewContent.appendChild(audio);
  } else if (ext === '.pdf') {
    const iframe = document.createElement('iframe');
    iframe.className = 'preview-iframe';
    iframe.src = streamUrl;
    previewContent.appendChild(iframe);
  }

  previewModal.classList.add('active');
}

function closeMediaPreview() {
  previewModal.classList.remove('active');
  const media = previewContent.querySelector('video, audio');
  if (media) {
    try {
      media.pause();
      media.removeAttribute('src');
      media.load();
    } catch (e) {}
  }
  previewContent.innerHTML = '';
}

// Prompt Modal Helper
function openPrompt(title, defaultValue, onSubmit) {
  promptTitle.textContent = title;
  promptInput.value = defaultValue || '';
  promptAction = onSubmit;
  promptModal.classList.add('active');
  promptInput.focus();
}

function closePrompt() {
  promptModal.classList.remove('active');
  promptAction = null;
}

promptForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = promptInput.value.trim();
  if (val && promptAction) {
    promptAction(val);
  }
  closePrompt();
});

promptCancelBtn.onclick = closePrompt;
promptCloseBtn.onclick = closePrompt;

// New Folder Handlers
function handleNewFolderAction() {
  openPrompt('Enter New Folder Name:', 'New Folder', async (name) => {
    try {
      const res = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath + '/' + name })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Created folder: ${name}`);
        loadDirectory(currentPath);
      } else {
        showToast(data.error);
      }
    } catch (e) {
      showToast(e.message);
    }
  });
}
document.getElementById('newFolderBtn').onclick = handleNewFolderAction;
if (mobileNewFolderBtn) mobileNewFolderBtn.onclick = handleNewFolderAction;

// New File Handlers
function handleNewFileAction() {
  openPrompt('Enter New File Name:', 'untitled.txt', async (name) => {
    try {
      const res = await fetch('/api/files/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath + '/' + name })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Created file: ${name}`);
        loadDirectory(currentPath);
      } else {
        showToast(data.error);
      }
    } catch (e) {
      showToast(e.message);
    }
  });
}
document.getElementById('newFileBtn').onclick = handleNewFileAction;
if (mobileNewFileBtn) mobileNewFileBtn.onclick = handleNewFileAction;

// Rename
function promptRename(item) {
  openPrompt(`Rename "${item.name}":`, item.name, async (newName) => {
    if (newName === item.name) return;
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: item.path, newName })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Renamed to: ${newName}`);
        loadDirectory(currentPath);
      } else {
        showToast(data.error);
      }
    } catch (e) {
      showToast(e.message);
    }
  });
}

// Delete
async function confirmDelete(item) {
  const confirmed = confirm(`Move "${item.name}" to Trash?`);
  if (!confirmed) return;

  try {
    const res = await fetch('/api/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: item.path })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Moved to Trash: ${item.name}`);
      loadDirectory(currentPath);
    } else {
      showToast(data.error);
    }
  } catch (e) {
    showToast(e.message);
  }
}

// Download Folder as ZIP
downloadFolderBtn.onclick = () => {
  if (!currentPath) return;
  const url = `/api/files/download?path=${encodeURIComponent(currentPath)}${getAuthTokenQuery()}`;
  window.location.href = url;
  showToast('Creating and downloading ZIP archive...');
};

// Upload Files Handlers
uploadBtn.onclick = () => fileUploadInput.click();
if (mobileUploadBtn) mobileUploadBtn.onclick = () => fileUploadInput.click();

fileUploadInput.onchange = () => {
  if (fileUploadInput.files.length > 0) {
    uploadFiles(fileUploadInput.files);
  }
};

// Drag and drop upload
let dragCounter = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropzoneOverlay.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropzoneOverlay.classList.remove('active');
  }
});

window.addEventListener('dragover', (e) => e.preventDefault());

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropzoneOverlay.classList.remove('active');
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    uploadFiles(e.dataTransfer.files);
  }
});

function uploadFiles(files) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  uploadStatus.classList.add('active');
  uploadText.textContent = `Uploading ${files.length} file(s)...`;
  uploadProgressFill.style.width = '0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/api/files/upload?uploadDir=${encodeURIComponent(currentPath)}`);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      uploadProgressFill.style.width = `${pct}%`;
      uploadText.textContent = `Uploading: ${pct}%`;
    }
  };

  xhr.onload = () => {
    uploadStatus.classList.remove('active');
    fileUploadInput.value = '';
    if (xhr.status === 200) {
      showToast('All files uploaded successfully');
      loadDirectory(currentPath);
    } else {
      showToast('Upload failed');
    }
  };

  xhr.onerror = () => {
    uploadStatus.classList.remove('active');
    showToast('Network error during file upload');
  };

  xhr.send(formData);
}

// ---------------- CONNECTIONS & SESSIONS MODAL ----------------
async function loadConnections() {
  try {
    const res = await fetch('/api/activity/connections');
    if (res.status === 401 || res.status === 403) return;
    const data = await res.json();
    if (!data.success) return;

    if (settingsConnCount) settingsConnCount.textContent = data.activeCount || 0;

    // Render Active Sessions
    activeConnectionsList.innerHTML = '';
    if (data.active.length === 0) {
      activeConnectionsList.innerHTML = '<div style="color: var(--text-muted); padding: 12px; text-align: center;">No active connections.</div>';
    } else {
      data.active.forEach(conn => {
        const card = document.createElement('div');
        card.className = 'connection-card';
        const isRemote = conn.networkType.includes('External');
        const netClass = isRemote ? 'remote' : 'local';

        card.innerHTML = `
          <div class="conn-left">
            <span class="conn-status-dot ${conn.isOnline ? 'online' : 'offline'}" title="${conn.isOnline ? 'Online' : 'Idle'}"></span>
            <div class="conn-info">
              <div class="conn-title">
                <span>${conn.username}</span>
                <span class="role-badge ${conn.role === 'guest' ? 'guest' : ''}">${conn.role}</span>
                <span class="conn-net-badge ${netClass}">${conn.networkType}</span>
              </div>
              <div class="conn-meta">
                <span>IP / Network: <strong>${conn.ip}</strong></span>
                <span>•</span>
                <span>${conn.device}</span>
                <span>•</span>
                <span>Last active: ${formatDate(conn.lastActive)}</span>
              </div>
            </div>
          </div>
          ${(currentUser?.role === 'admin' && conn.sessionId) ? '<div><button class="btn btn-danger btn-sm revoke-btn">Disconnect</button></div>' : ''}
        `;

        const revokeBtnEl = card.querySelector('.revoke-btn');
        if (revokeBtnEl) {
          revokeBtnEl.onclick = async () => {
            if (confirm(`Disconnect session for "${conn.username}"?`)) {
              await fetch('/api/activity/revoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: conn.sessionId })
              });
              showToast('Session disconnected');
              loadConnections();
            }
          };
        }

        activeConnectionsList.appendChild(card);
      });
    }

    // Render History
    historyConnectionsList.innerHTML = '';
    if (data.history.length === 0) {
      historyConnectionsList.innerHTML = '<div style="color: var(--text-muted); padding: 12px; text-align: center;">No connection history yet.</div>';
    } else {
      data.history.forEach(item => {
        const card = document.createElement('div');
        card.className = 'connection-card';
        const isRemote = item.networkType.includes('External');
        const netClass = isRemote ? 'remote' : 'local';

        card.innerHTML = `
          <div class="conn-left">
            <div class="conn-info">
              <div class="conn-title">
                <span>${item.username}</span>
                <span class="role-badge ${item.role === 'guest' ? 'guest' : ''}">${item.role}</span>
                <span class="conn-net-badge ${netClass}">${item.networkType}</span>
              </div>
              <div class="conn-meta">
                <span>IP: <strong>${item.ip}</strong></span>
                <span>•</span>
                <span>${item.device}</span>
                <span>•</span>
                <span>Connected at: ${formatDate(item.timestamp)}</span>
              </div>
            </div>
          </div>
        `;
        historyConnectionsList.appendChild(card);
      });
    }
  } catch (err) {}
}



tabActiveBtn.onclick = () => {
  tabActiveBtn.classList.add('active');
  tabHistoryBtn.classList.remove('active');
  tabActiveContent.style.display = 'block';
  tabHistoryContent.style.display = 'none';
};

tabHistoryBtn.onclick = () => {
  tabHistoryBtn.classList.add('active');
  tabActiveBtn.classList.remove('active');
  tabHistoryContent.style.display = 'block';
  tabActiveContent.style.display = 'none';
};

// ---------------- GUESTS MANAGEMENT MODAL ----------------
async function loadGuests() {
  try {
    const res = await fetch('/api/guests');
    if (res.status === 401) return;
    const data = await res.json();
    if (!data.success) return;

    guestsList.innerHTML = '';
    if (data.guests.length === 0) {
      guestsList.innerHTML = '<div style="color: var(--text-muted); padding: 8px;">No guest accounts created yet.</div>';
      return;
    }

    data.guests.forEach(g => {
      const card = document.createElement('div');
      card.className = 'guest-card';

      const allowedFolders = [];
      if (Array.isArray(g.permissions?.folderAccess?.customFolders)) {
        g.permissions.folderAccess.customFolders.forEach(cf => {
          if (!cf) return;
          let name = cf.name;
          if (!name && cf.path) {
            const parts = cf.path.replace(/\\/g, '/').split('/').filter(Boolean);
            name = parts.length > 0 ? parts[parts.length - 1] : cf.path;
          }
          if (name) allowedFolders.push(name);
        });
      }
      const foldersText = allowedFolders.length > 0 ? allowedFolders.join(', ') : 'None';

      const permsText = [
        g.permissions?.canDownload ? 'Download' : '',
        g.permissions?.canWrite ? 'Upload/Edit' : '',
        g.permissions?.canDelete ? 'Delete' : ''
      ].filter(Boolean).join(', ') || 'Read-Only';

      const isAdmin = currentUser?.role === 'admin';
      const adminActions = isAdmin ? `
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm msg-guest-btn">Message</button>
          <button class="btn btn-secondary btn-sm edit-guest-btn">Edit</button>
          <button class="btn btn-danger btn-sm del-guest-btn">Delete</button>
        </div>
      ` : `
        <div style="font-size: 11px; color: var(--text-muted); font-style: italic;">
          Active Guest
        </div>
      `;

      card.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
          <div style="font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>${escapeHtml(g.name || g.username)}</span>
            <span style="font-size: 12px; color: var(--text-secondary); font-weight: normal;">@${escapeHtml(g.username)}</span>
            <span class="role-badge guest">Guest</span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
            <span style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">Password:</span>
            <code style="background: var(--bg-primary); padding: 2px 7px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 11px; font-weight: 600; color: var(--accent-blue);">${escapeHtml(g.password)}</code>
            <button type="button" class="icon-btn-ghost copy-pass-btn" title="Copy Password" style="padding: 2px; height: auto;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            Allowed Folders: <strong style="color: var(--text-primary);">${escapeHtml(foldersText)}</strong>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary);">
            Permissions: <strong>${escapeHtml(permsText)}</strong>
          </div>
        </div>
        ${adminActions}
      `;

      const copyPassBtn = card.querySelector('.copy-pass-btn');
      if (copyPassBtn) {
        copyPassBtn.onclick = () => {
          copyTextToClipboard(g.password, `Password copied for @${g.username}`);
        };
      }

      const msgGuestBtn = card.querySelector('.msg-guest-btn');
      if (msgGuestBtn) {
        msgGuestBtn.onclick = () => {
          if (settingsModal) settingsModal.classList.remove('active');
          openMessagesModal(g.id);
          setTimeout(() => {
            if (chatMessageInput) {
              chatMessageInput.focus();
              chatMessageInput.placeholder = `Message to @${g.username}...`;
            }
          }, 100);
        };
      }

      const editGuestBtn = card.querySelector('.edit-guest-btn');
      if (editGuestBtn) {
        editGuestBtn.onclick = () => openEditGuestModal(g);
      }

      const delGuestBtn = card.querySelector('.del-guest-btn');
      if (delGuestBtn) {
        delGuestBtn.onclick = async () => {
          if (confirm(`Delete guest account "${g.name || g.username}" (@${g.username})?`)) {
            const dres = await fetch('/api/guests/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: g.id })
            });
            const ddata = await dres.json();
            if (ddata.success) {
              showToast(`Guest "${g.username}" deleted`);
              loadGuests();
            } else {
              showToast(ddata.error);
            }
          }
        };
      }

      guestsList.appendChild(card);
    });
  } catch (err) {}
}

let createCustomFolders = [];
let editCustomFolders = [];

function renderCreateCustomFolders() {
  const container = document.getElementById('createCustomFoldersList');
  if (!container) return;
  container.innerHTML = '';
  if (createCustomFolders.length === 0) {
    container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">No custom folder paths added.</div>';
    return;
  }
  createCustomFolders.forEach((cf, index) => {
    const chip = document.createElement('div');
    chip.className = 'custom-folder-chip';
    chip.innerHTML = `
      <div style="min-width: 0; flex: 1;">
        <span class="custom-folder-chip-name">${escapeHtml(cf.name)}</span>
        <span class="custom-folder-chip-path" title="${escapeHtml(cf.path)}">${escapeHtml(cf.path)}</span>
      </div>
      <button type="button" class="custom-folder-chip-remove" title="Remove Folder">&times;</button>
    `;
    chip.querySelector('.custom-folder-chip-remove').onclick = () => {
      createCustomFolders.splice(index, 1);
      renderCreateCustomFolders();
    };
    container.appendChild(chip);
  });
}

function renderEditCustomFolders() {
  const container = document.getElementById('editCustomFoldersList');
  if (!container) return;
  container.innerHTML = '';
  if (editCustomFolders.length === 0) {
    container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">No custom folder paths added.</div>';
    return;
  }
  editCustomFolders.forEach((cf, index) => {
    const chip = document.createElement('div');
    chip.className = 'custom-folder-chip';
    chip.innerHTML = `
      <div style="min-width: 0; flex: 1;">
        <span class="custom-folder-chip-name">${escapeHtml(cf.name)}</span>
        <span class="custom-folder-chip-path" title="${escapeHtml(cf.path)}">${escapeHtml(cf.path)}</span>
      </div>
      <button type="button" class="custom-folder-chip-remove" title="Remove Folder">&times;</button>
    `;
    chip.querySelector('.custom-folder-chip-remove').onclick = () => {
      editCustomFolders.splice(index, 1);
      renderEditCustomFolders();
    };
    container.appendChild(chip);
  });
}

async function addCustomFolderToCreate() {
  const input = document.getElementById('createCustomFolderPath');
  if (!input) return;
  const folderPath = input.value.trim();
  if (!folderPath) {
    showToast('Please enter or paste a valid folder path');
    return;
  }
  if (createCustomFolders.some(cf => cf.path === folderPath)) {
    showToast('Folder already added to list');
    return;
  }
  try {
    const res = await fetch('/api/files/validate-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    const data = await res.json();
    if (data.success) {
      createCustomFolders.push({ name: data.name, path: data.path });
      input.value = '';
      renderCreateCustomFolders();
      showToast(`Added folder: ${data.name}`);
    } else {
      showToast(data.error || 'Invalid folder path');
    }
  } catch (err) {
    showToast(err.message);
  }
}

async function addCustomFolderToEdit() {
  const input = document.getElementById('editCustomFolderPath');
  if (!input) return;
  const folderPath = input.value.trim();
  if (!folderPath) {
    showToast('Please enter or paste a valid folder path');
    return;
  }
  if (editCustomFolders.some(cf => cf.path === folderPath)) {
    showToast('Folder already added to list');
    return;
  }
  try {
    const res = await fetch('/api/files/validate-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });
    const data = await res.json();
    if (data.success) {
      editCustomFolders.push({ name: data.name, path: data.path });
      input.value = '';
      renderEditCustomFolders();
      showToast(`Added folder: ${data.name}`);
    } else {
      showToast(data.error || 'Invalid folder path');
    }
  } catch (err) {
    showToast(err.message);
  }
}

const createAddCustomFolderBtn = document.getElementById('createAddCustomFolderBtn');
const createCustomFolderPathInput = document.getElementById('createCustomFolderPath');
if (createAddCustomFolderBtn) createAddCustomFolderBtn.onclick = addCustomFolderToCreate;
if (createCustomFolderPathInput) {
  createCustomFolderPathInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomFolderToCreate();
    }
  };
}

const editAddCustomFolderBtn = document.getElementById('editAddCustomFolderBtn');
const editCustomFolderPathInput = document.getElementById('editCustomFolderPath');
if (editAddCustomFolderBtn) editAddCustomFolderBtn.onclick = addCustomFolderToEdit;
if (editCustomFolderPathInput) {
  editCustomFolderPathInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomFolderToEdit();
    }
  };
}

function openEditGuestModal(guest) {
  const modal = document.getElementById('editGuestModal');
  if (!modal) return;
  document.getElementById('editGuestId').value = guest.id;
  document.getElementById('editGuestName').value = guest.name || guest.username;
  document.getElementById('editGuestUsername').value = guest.username;
  document.getElementById('editGuestPassword').value = '';
  document.getElementById('editPermDownload').checked = Boolean(guest.permissions?.canDownload);
  document.getElementById('editPermWrite').checked = Boolean(guest.permissions?.canWrite);
  document.getElementById('editPermDelete').checked = Boolean(guest.permissions?.canDelete);

  editCustomFolders = Array.isArray(guest.permissions?.folderAccess?.customFolders)
    ? JSON.parse(JSON.stringify(guest.permissions.folderAccess.customFolders))
    : [];
  renderEditCustomFolders();

  modal.classList.add('active');
}

function closeEditGuestModal() {
  const modal = document.getElementById('editGuestModal');
  if (modal) modal.classList.remove('active');
}

const editGuestCloseBtn = document.getElementById('editGuestCloseBtn');
const editGuestCancelBtn = document.getElementById('editGuestCancelBtn');
const editGuestForm = document.getElementById('editGuestForm');

if (editGuestCloseBtn) editGuestCloseBtn.onclick = closeEditGuestModal;
if (editGuestCancelBtn) editGuestCancelBtn.onclick = closeEditGuestModal;

if (editGuestForm) {
  editGuestForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editGuestId').value;
    const name = document.getElementById('editGuestName').value.trim();
    const password = document.getElementById('editGuestPassword').value;
    const canDownload = document.getElementById('editPermDownload').checked;
    const canWrite = document.getElementById('editPermWrite').checked;
    const canDelete = document.getElementById('editPermDelete').checked;
    const folderAccess = {
      customFolders: editCustomFolders
    };

    try {
      const payload = {
        id,
        name,
        permissions: {
          canDownload,
          canWrite,
          canDelete,
          folderAccess
        }
      };
      if (password && password.trim().length >= 4) {
        payload.password = password.trim();
      }

      const res = await fetch('/api/guests/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Guest updated successfully');
        closeEditGuestModal();
        loadGuests();
      } else {
        showToast(data.error || 'Failed to update guest');
      }
    } catch (err) {
      showToast(err.message);
    }
  };
}

// ---------------- PERMISSION REQUESTS & GUEST PERMISSIONS ----------------
async function loadPendingRequests() {
  if (currentUser?.role !== 'admin') return;
  try {
    const res = await fetch('/api/requests/pending');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    const pendingRequestsList = document.getElementById('pendingRequestsList');
    const notifRequestsList = document.getElementById('notifRequestsList');
    const pendingRequestsCountBadge = document.getElementById('pendingRequestsCountBadge');
    const pendingRequestsCountPill = document.getElementById('pendingRequestsCountPill');

    const count = (data.pending || []).length;
    if (pendingRequestsCountBadge) {
      pendingRequestsCountBadge.textContent = `${count} Pending`;
    }
    if (pendingRequestsCountPill) {
      if (count > 0) {
        pendingRequestsCountPill.textContent = count;
        pendingRequestsCountPill.style.display = 'inline-flex';
      } else {
        pendingRequestsCountPill.style.display = 'none';
      }
    }

    function renderRequestsList(container) {
      if (!container) return;
      container.innerHTML = '';

      if (count === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0; text-align: center;">No pending requests from guests.</div>';
        return;
      }

      data.pending.forEach(req => {
        const card = document.createElement('div');
        card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); gap: 10px;';

        const senderDisplay = req.name ? `${escapeHtml(req.name)} (@${escapeHtml(req.username)})` : `@${escapeHtml(req.username)}`;

        card.innerHTML = `
          <div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
              <span>${senderDisplay}</span> requested <span style="color: var(--accent-blue);">${escapeHtml(req.permissionLabel)}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              ${formatDate(req.createdAt)}
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-shrink: 0;">
            <button class="btn btn-primary btn-sm approve-req-btn" style="background: var(--accent-green); border-color: var(--accent-green); padding: 4px 10px; font-size: 12px;">Approve</button>
            <button class="btn btn-secondary btn-sm decline-req-btn" style="padding: 4px 10px; font-size: 12px;">Decline</button>
          </div>
        `;

        card.querySelector('.approve-req-btn').onclick = async () => {
          try {
            const ares = await fetch('/api/requests/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestId: req.id })
            });
            const adata = await ares.json();
            if (adata.success) {
              showToast(`Approved "${req.permissionLabel}" for ${senderDisplay}`);
              loadPendingRequests();
              loadGuests();
              updateNotificationsSummary();
            } else {
              showToast(adata.error || 'Failed to approve');
            }
          } catch (e) {
            showToast(e.message);
          }
        };

        card.querySelector('.decline-req-btn').onclick = async () => {
          try {
            const dres = await fetch('/api/requests/decline', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestId: req.id })
            });
            const ddata = await dres.json();
            if (ddata.success) {
              showToast(`Declined request from ${senderDisplay}`);
              loadPendingRequests();
              updateNotificationsSummary();
            } else {
              showToast(ddata.error || 'Failed to decline');
            }
          } catch (e) {
            showToast(e.message);
          }
        };

        container.appendChild(card);
      });
    }

    renderRequestsList(pendingRequestsList);
    renderRequestsList(notifRequestsList);
  } catch (err) {}
}

async function loadGuestPermissions() {
  if (currentUser?.role === 'admin') return;

  const guestPermUsernameBadge = document.getElementById('guestPermUsernameBadge');
  if (guestPermUsernameBadge) {
    const disp = currentUser?.name ? `${currentUser.name} (@${currentUser.username})` : `@${currentUser?.username || 'guest'}`;
    guestPermUsernameBadge.textContent = disp;
  }

  // Permitted Folders Badges
  const guestAllowedFoldersDesc = document.getElementById('guestAllowedFoldersDesc');
  const guestAllowedFoldersBadges = document.getElementById('guestAllowedFoldersBadges');
  if (guestAllowedFoldersBadges) {
    const fa = currentUser?.permissions?.folderAccess || {};
    const allowed = [];
    if (Array.isArray(fa.customFolders)) {
      fa.customFolders.forEach(cf => {
        if (!cf) return;
        let name = cf.name;
        if (!name && cf.path) {
          const parts = cf.path.replace(/\\/g, '/').split('/').filter(Boolean);
          name = parts.length > 0 ? parts[parts.length - 1] : cf.path;
        }
        if (name) allowed.push(name);
      });
    }

    if (guestAllowedFoldersDesc) {
      guestAllowedFoldersDesc.textContent = allowed.length > 0
        ? `Access granted to: ${allowed.join(', ')}`
        : 'No folder access assigned yet. Please contact admin.';
    }

    guestAllowedFoldersBadges.innerHTML = allowed.map(folder =>
      `<span class="conn-net-badge local" style="background: rgba(48, 209, 88, 0.15); color: var(--accent-green); border-color: rgba(48, 209, 88, 0.3);">${escapeHtml(folder)}</span>`
    ).join('') || '<span class="conn-net-badge" style="color: var(--accent-orange);">None</span>';
  }

  let requests = [];
  try {
    const res = await fetch('/api/requests/my');
    if (res.ok) {
      const data = await res.json();
      requests = data.requests || [];
    }
  } catch (err) {}

  const pendingDownload = requests.find(r => r.permission === 'canDownload' && r.status === 'pending');
  const pendingWrite = requests.find(r => r.permission === 'canWrite' && r.status === 'pending');
  const pendingDelete = requests.find(r => r.permission === 'canDelete' && r.status === 'pending');

  const permDownloadStatus = document.getElementById('permDownloadStatus');
  if (permDownloadStatus) {
    if (currentUser?.permissions?.canDownload) {
      permDownloadStatus.innerHTML = '<span class="conn-net-badge local" style="background: rgba(48, 209, 88, 0.15); color: var(--accent-green); border-color: rgba(48, 209, 88, 0.3);">Granted</span>';
    } else if (pendingDownload) {
      permDownloadStatus.innerHTML = '<span class="conn-net-badge" style="background: rgba(255, 159, 10, 0.15); color: var(--accent-orange); border-color: rgba(255, 159, 10, 0.3);">Pending Approval</span>';
    } else {
      permDownloadStatus.innerHTML = '<button class="btn btn-primary btn-sm request-btn" style="padding: 4px 10px; font-size: 12px;">Request Permission</button>';
      permDownloadStatus.querySelector('.request-btn').onclick = () => requestGuestPermission('canDownload');
    }
  }

  const permWriteStatus = document.getElementById('permWriteStatus');
  if (permWriteStatus) {
    if (currentUser?.permissions?.canWrite) {
      permWriteStatus.innerHTML = '<span class="conn-net-badge local" style="background: rgba(48, 209, 88, 0.15); color: var(--accent-green); border-color: rgba(48, 209, 88, 0.3);">Granted</span>';
    } else if (pendingWrite) {
      permWriteStatus.innerHTML = '<span class="conn-net-badge" style="background: rgba(255, 159, 10, 0.15); color: var(--accent-orange); border-color: rgba(255, 159, 10, 0.3);">Pending Approval</span>';
    } else {
      permWriteStatus.innerHTML = '<button class="btn btn-primary btn-sm request-btn" style="padding: 4px 10px; font-size: 12px;">Request Permission</button>';
      permWriteStatus.querySelector('.request-btn').onclick = () => requestGuestPermission('canWrite');
    }
  }

  const permDeleteStatus = document.getElementById('permDeleteStatus');
  if (permDeleteStatus) {
    if (currentUser?.permissions?.canDelete) {
      permDeleteStatus.innerHTML = '<span class="conn-net-badge local" style="background: rgba(48, 209, 88, 0.15); color: var(--accent-green); border-color: rgba(48, 209, 88, 0.3);">Granted</span>';
    } else if (pendingDelete) {
      permDeleteStatus.innerHTML = '<span class="conn-net-badge" style="background: rgba(255, 159, 10, 0.15); color: var(--accent-orange); border-color: rgba(255, 159, 10, 0.3);">Pending Approval</span>';
    } else {
      permDeleteStatus.innerHTML = '<button class="btn btn-primary btn-sm request-btn" style="padding: 4px 10px; font-size: 12px;">Request Permission</button>';
      permDeleteStatus.querySelector('.request-btn').onclick = () => requestGuestPermission('canDelete');
    }
  }
}

async function requestGuestPermission(permission) {
  try {
    const res = await fetch('/api/requests/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Permission request submitted to administrator');
      loadGuestPermissions();
      updateNotificationsSummary();
    } else {
      showToast(data.error || 'Failed to submit request');
    }
  } catch (err) {
    showToast(err.message);
  }
}

createGuestForm.onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('guestName').value.trim();
  const username = document.getElementById('guestUsername').value.trim();
  const password = document.getElementById('guestPassword').value;
  const canDownload = document.getElementById('permDownload').checked;
  const canWrite = document.getElementById('permWrite').checked;
  const canDelete = document.getElementById('permDelete').checked;
  const folderAccess = {
    customFolders: createCustomFolders
  };

  try {
    const res = await fetch('/api/guests/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        username,
        password,
        permissions: {
          canDownload,
          canWrite,
          canDelete,
          folderAccess
        }
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Guest "${name || username}" created successfully!`);
      createGuestForm.reset();
      createCustomFolders = [];
      renderCreateCustomFolders();
      document.getElementById('permDownload').checked = false;
      loadGuests();
    } else {
      showToast(data.error || 'Failed to create guest');
    }
  } catch (err) {
    showToast(err.message);
  }
};

// System Metrics
async function updateMetrics() {
  try {
    const res = await fetch('/api/system/metrics');
    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    const data = await res.json();
    if (data.success) {
      const primaryNet = data.network[0];
      if (primaryNet) {
        currentLocalUrl = `http://${primaryNet.address}:${window.location.port || '7890'}`;
        updateLocalNetworkInfo();
      }

      if (data.battery && data.battery.percent !== null) {
        batteryBadge.style.display = 'inline-flex';
        batteryText.textContent = `${data.battery.percent}%`;
      }

      if (data.disk) {
        storageStats.textContent = `${data.disk.free} free`;
        storageBarFill.style.width = `${data.disk.percentUsed}%`;
      }
    }
  } catch (err) {}
}

async function updateTunnelStatus() {
  try {
    const res = await fetch('/api/system/tunnel');
    const data = await res.json();
    if (data.running && data.url) {
      currentTunnelUrl = data.url;
      tunnelStatusText.textContent = 'Internet: Active';
      tunnelBadge.className = 'badge badge-green';
    } else {
      currentTunnelUrl = '';
      tunnelStatusText.textContent = 'Internet: Offline';
      tunnelBadge.className = 'badge badge-orange';
    }
  } catch (err) {}
}

// Local Network Info in Settings
function updateLocalNetworkInfo() {
  const localUrl = currentLocalUrl || window.location.origin;
  if (settingsLocalUrl) {
    settingsLocalUrl.href = localUrl;
    settingsLocalUrl.textContent = localUrl;
  }
  fetch(`/api/system/qr?url=${encodeURIComponent(localUrl)}`)
    .then(r => r.json())
    .then(d => {
      if (d.success && settingsLocalQrImg) settingsLocalQrImg.src = d.qr;
    }).catch(() => {});
}

if (copyLocalUrlBtn) {
  copyLocalUrlBtn.onclick = () => {
    const localUrl = currentLocalUrl || settingsLocalUrl?.href || settingsLocalUrl?.textContent || window.location.origin;
    copyTextToClipboard(localUrl, 'Local LAN link copied to clipboard!');
  };
}

// Server Name Form Submission
if (serverNameForm) {
  serverNameForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = serverNameInput.value.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/settings/server-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        if (headerServerName) headerServerName.textContent = data.serverName;
        document.title = `${data.serverName} — Personal Cloud`;
        showToast(`Server name updated to "${data.serverName}"`);
      } else {
        showToast(data.error || 'Failed to update server name');
      }
    } catch (err) {
      showToast('Error updating server name: ' + err.message);
    }
  };
}

function updateRemoteModalUI(data) {
  const isOnline = Boolean(data && data.running && data.url);
  if (data && data.url) {
    currentTunnelUrl = data.url;
  }
  if (remoteSwitchCheckbox) {
    remoteSwitchCheckbox.checked = isOnline;
  }
  if (remoteStatusBadge) {
    remoteStatusBadge.textContent = isOnline ? 'Online (Public HTTPS)' : 'Disabled (Local Only)';
    remoteStatusBadge.className = isOnline ? 'conn-net-badge remote' : 'conn-net-badge local';
  }
  if (remoteStatusExplanation) {
    remoteStatusExplanation.textContent = isOnline
      ? 'Your computer is securely reachable over the global internet via encrypted Cloudflare Tunnel.'
      : 'Remote tunnel is off. External internet traffic cannot reach your computer. Only devices on your Wi-Fi / LAN can access.';
  }

  if (isOnline) {
    if (remoteActiveSection) remoteActiveSection.style.display = 'block';
    if (remoteInactiveSection) remoteInactiveSection.style.display = 'none';
    if (remoteModalLink) {
      remoteModalLink.href = data.url;
      remoteModalLink.textContent = data.url;
    }
    fetch(`/api/system/qr?url=${encodeURIComponent(data.url)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && remoteModalQrImg) remoteModalQrImg.src = d.qr;
      }).catch(() => {});
  } else {
    if (remoteActiveSection) remoteActiveSection.style.display = 'none';
    if (remoteInactiveSection) remoteInactiveSection.style.display = 'block';
    if (remoteModalLink) {
      remoteModalLink.href = '#';
      remoteModalLink.textContent = '...';
    }
  }
}

if (remoteSwitchCheckbox) {
  remoteSwitchCheckbox.onchange = async () => {
    const shouldStart = remoteSwitchCheckbox.checked;
    showToast(shouldStart ? 'Starting Remote Internet Tunnel...' : 'Stopping Remote Internet Access...');
    try {
      const res = await fetch('/api/system/tunnel/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: shouldStart ? 'start' : 'stop' })
      });
      const data = await res.json();
      await updateTunnelStatus();
      updateRemoteModalUI(data);
      showToast(data.running ? 'Remote Access is now ONLINE' : 'Remote Access is now OFF (Local Only)');
    } catch (err) {
      showToast('Toggle error: ' + err.message);
      remoteSwitchCheckbox.checked = !shouldStart;
    }
  };
}

if (copyRemoteUrlBtn) {
  copyRemoteUrlBtn.onclick = async () => {
    let url = currentTunnelUrl;
    if (!url && remoteModalLink) {
      const href = remoteModalLink.getAttribute('href');
      if (href && href !== '#' && href.startsWith('http')) {
        url = href;
      } else {
        const text = remoteModalLink.textContent?.trim();
        if (text && text !== '...' && text.startsWith('http')) {
          url = text;
        }
      }
    }
    if (!url && window.location.protocol === 'https:' && window.location.hostname.includes('trycloudflare.com')) {
      url = window.location.origin;
    }
    if (!url) {
      try {
        const res = await fetch('/api/system/tunnel');
        const data = await res.json();
        if (data && data.url) {
          url = data.url;
          currentTunnelUrl = data.url;
          updateRemoteModalUI(data);
        }
      } catch (e) {}
    }

    if (url) {
      await copyTextToClipboard(url, 'Remote link copied to clipboard!');
    } else {
      showToast('Remote link is not active or available');
    }
  };
}

// Settings Navigation Tabs
function switchSettingsTab(tabName) {
  const isAdmin = currentUser?.role === 'admin';
  if (!isAdmin) {
    if (tabName !== 'remote' && tabName !== 'permissions' && tabName !== 'profile') {
      tabName = 'remote';
    }
  }

  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.settings-tab-pane').forEach(pane => {
    pane.style.display = 'none';
  });

  const tabId = 'pane' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.style.display = 'block';

  if (tabName === 'general' && isAdmin) updateLocalNetworkInfo();
  if (tabName === 'remote') {
    fetch('/api/system/tunnel')
      .then(r => r.json())
      .then(d => updateRemoteModalUI(d))
      .catch(() => {});
  }
  if (tabName === 'permissions' && !isAdmin) loadGuestPermissions();
  if (tabName === 'connections' && isAdmin) loadConnections();
  if (tabName === 'guests' && isAdmin) {
    loadGuests();
    loadPendingRequests();
  }
  if (tabName === 'profile') {
    loadProfile();
  }
}

document.querySelectorAll('.settings-tab-btn').forEach(btn => {
  btn.onclick = () => switchSettingsTab(btn.dataset.tab);
});

function openSettings(tab) {
  if (settingsModal) {
    const isAdmin = currentUser?.role === 'admin';
    if (!tab) {
      tab = isAdmin ? 'general' : 'remote';
    }
    if (!isAdmin && tab !== 'remote' && tab !== 'permissions' && tab !== 'profile') {
      tab = 'remote';
    }
    settingsModal.classList.add('active');
    switchSettingsTab(tab);
  }
}

if (settingsBtn) {
  settingsBtn.onclick = () => openSettings();
}
if (tunnelBadge) {
  tunnelBadge.onclick = () => openSettings('remote');
}
if (settingsCloseBtn) {
  settingsCloseBtn.onclick = () => settingsModal.classList.remove('active');
}

// Settings Profile Logic
async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !data.user) return;

    if (currentUser?.role === 'admin') {
      if (adminProfileName) adminProfileName.value = data.user.name || 'Administrator';
      if (adminProfileUsername) adminProfileUsername.value = data.user.username || 'admin';
      if (adminCurrentPass) adminCurrentPass.value = '';
      if (adminNewPass) adminNewPass.value = '';
    } else {
      if (guestProfileName) guestProfileName.value = data.user.name || '';
      if (guestProfileUsername) guestProfileUsername.value = data.user.username || '';
      if (guestProfileNewPass) guestProfileNewPass.value = '';
      if (guestProfileConfirmPass) guestProfileConfirmPass.value = '';
    }
  } catch (err) {}
}

if (adminProfileForm) {
  adminProfileForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = adminProfileName ? adminProfileName.value.trim() : '';
    const currentPassword = adminCurrentPass ? adminCurrentPass.value : '';
    const newPassword = adminNewPass ? adminNewPass.value : '';

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Admin profile and password updated successfully');
        if (data.user) {
          currentUser = { ...currentUser, ...data.user };
          updateUserProfileDisplay(currentUser);
        }
        if (adminCurrentPass) adminCurrentPass.value = '';
        if (adminNewPass) adminNewPass.value = '';
      } else {
        showToast(data.error || 'Failed to update admin profile');
      }
    } catch (err) {
      showToast(err.message);
    }
  };
}

if (guestProfileForm) {
  guestProfileForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = guestProfileName ? guestProfileName.value.trim() : '';
    const username = guestProfileUsername ? guestProfileUsername.value.trim() : '';
    const password = guestProfileNewPass ? guestProfileNewPass.value : '';
    const confirmPass = guestProfileConfirmPass ? guestProfileConfirmPass.value : '';

    if (password) {
      if (password.length < 4) {
        showToast('New password must be at least 4 characters');
        return;
      }
      if (confirmPass && password !== confirmPass) {
        showToast('New passwords do not match');
        return;
      }
    }

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password })
      });
      const data = await res.json();
      if (data.success) {
        showToast(password ? 'Profile and password updated successfully' : 'Profile updated successfully');
        if (data.user) {
          currentUser = { ...currentUser, ...data.user };
          updateUserProfileDisplay(currentUser);
        }
        if (guestProfileNewPass) guestProfileNewPass.value = '';
        if (guestProfileConfirmPass) guestProfileConfirmPass.value = '';
      } else {
        showToast(data.error || 'Failed to update profile');
      }
    } catch (err) {
      showToast(err.message);
    }
  };
}

// Logout
logoutBtn.onclick = async () => {
  localStorage.removeItem('cloud_token');
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
};

// Toolbar buttons
if (copyCurrentPathBtn) {
  copyCurrentPathBtn.onclick = () => {
    if (!currentPath) {
      showToast('No directory path available');
      return;
    }
    copyTextToClipboard(currentPath, `Copied folder path: ${currentPath}`);
  };
}

viewToggleBtn.onclick = () => {
  viewMode = viewMode === 'grid' ? 'table' : 'grid';
  localStorage.setItem('mac_view_mode', viewMode);
  renderItems(currentItems);
};

hiddenFilesBtn.onclick = () => {
  showHidden = !showHidden;
  localStorage.setItem('mac_show_hidden', showHidden.toString());
  showToast(showHidden ? 'Showing hidden files' : 'Hiding hidden files');
  loadDirectory(currentPath);
};

sortSelect.onchange = (e) => {
  sortBy = e.target.value;
  renderItems(currentItems);
};

// Search filter
let searchTimer = null;
searchInput.oninput = (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim().toLowerCase();
  searchTimer = setTimeout(() => {
    if (!q) {
      renderItems(currentItems);
      return;
    }
    const filtered = currentItems.filter(item => item.name.toLowerCase().includes(q));
    renderItems(filtered);
  }, 200);
};

// Notifications Modal Management
let activeNotifTab = 'all';

async function openNotifModal(tab = 'all') {
  if (!notifModal) return;
  if (!currentUser) {
    await checkAuth();
  }
  const isAdmin = currentUser?.role === 'admin';
  notifModal.classList.add('active');

  if (isAdmin) {
    switchNotifTab(tab || 'all');
  } else {
    loadGuestNotifications();
  }
  updateNotificationsSummary();
}

function closeNotifModal() {
  if (notifModal) notifModal.classList.remove('active');
}

function switchNotifTab(tab) {
  activeNotifTab = tab;
  if (notifTabAllBtn) notifTabAllBtn.classList.toggle('active', tab === 'all');
  if (notifTabDownloadsBtn) notifTabDownloadsBtn.classList.toggle('active', tab === 'downloads');
  if (notifTabReqBtn) notifTabReqBtn.classList.toggle('active', tab === 'requests');
  loadAdminNotifications(tab);
}

async function loadGuestNotifications() {
  if (!unifiedNotifList) return;
  try {
    const res = await fetch('/api/notifications/summary');
    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    const requests = data.requests || [];
    unifiedNotifList.innerHTML = '';

    if (requests.length === 0) {
      unifiedNotifList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 32px 16px; text-align: center; font-style: italic;">You have no notifications at this time.</div>';
      return;
    }

    requests.forEach(req => {
      const card = document.createElement('div');
      card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); gap: 10px;';

      let statusBadge = '';
      if (req.status === 'approved') {
        statusBadge = '<span class="conn-net-badge" style="background: rgba(48, 209, 88, 0.15); color: var(--accent-green); border-color: rgba(48, 209, 88, 0.3);">Approved</span>';
      } else if (req.status === 'declined') {
        statusBadge = '<span class="conn-net-badge" style="background: rgba(255, 69, 58, 0.15); color: var(--accent-red); border-color: rgba(255, 69, 58, 0.3);">Declined</span>';
      } else {
        statusBadge = '<span class="conn-net-badge" style="background: rgba(10, 132, 255, 0.15); color: var(--accent-blue); border-color: rgba(10, 132, 255, 0.3);">Pending</span>';
      }

      const actionText = req.status === 'approved'
        ? `Administrator approved your request for <strong>${escapeHtml(req.permissionLabel)}</strong>.`
        : (req.status === 'declined'
          ? `Administrator declined your request for <strong>${escapeHtml(req.permissionLabel)}</strong>.`
          : `Your request for <strong>${escapeHtml(req.permissionLabel)}</strong> is waiting for administrator approval.`);

      card.innerHTML = `
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
            ${statusBadge}
            <span style="font-size: 13px; color: var(--text-primary);">${actionText}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary);">
            ${formatDate(req.resolvedAt || req.createdAt)}
          </div>
        </div>
      `;
      unifiedNotifList.appendChild(card);
    });

    await fetch('/api/notifications/requests/read', { method: 'POST' });
    updateNotificationsSummary();
  } catch (err) {}
}

async function loadAdminNotifications(filter = 'all') {
  if (!unifiedNotifList) return;
  if (currentUser && currentUser.role !== 'admin') return;
  try {
    const [dlRes, reqRes, msgRes] = await Promise.all([
      fetch('/api/notifications/downloads'),
      fetch('/api/requests/pending'),
      fetch('/api/messages')
    ]);

    if (dlRes.status === 401 || reqRes.status === 401 || msgRes.status === 401) {
      window.location.href = '/login.html';
      return;
    }

    const dlData = dlRes.ok ? await dlRes.json() : { downloads: [] };
    const reqData = reqRes.ok ? await reqRes.json() : { pending: [] };
    const msgData = msgRes.ok ? await msgRes.json() : { messages: [] };

    // Separate actual downloads from security/account activities
    const actualDownloads = (dlData.downloads || [])
      .filter(dl => !dl.type || dl.type === 'download')
      .map(dl => ({
        kind: 'download',
        item: dl,
        timestamp: new Date(dl.timestamp || dl.downloadedAt || Date.now()).getTime()
      }));

    const securityActivities = (dlData.downloads || [])
      .filter(dl => dl.type === 'guest_password_changed' || dl.type === 'account_activity')
      .map(act => ({
        kind: 'security',
        item: act,
        timestamp: new Date(act.timestamp || act.downloadedAt || Date.now()).getTime()
      }));

    const requests = (reqData.pending || []).map(req => ({
      kind: 'request',
      item: req,
      timestamp: new Date(req.createdAt || Date.now()).getTime()
    }));

    // Messages sent by guests/users to admin or public
    const messages = (msgData.messages || [])
      .filter(m => m.senderRole === 'guest' || (m.senderUsername && m.senderUsername.toLowerCase() !== 'admin'))
      .map(msg => ({
        kind: 'message',
        item: msg,
        timestamp: new Date(msg.createdAt || Date.now()).getTime()
      }));

    let combined = [];
    if (filter === 'downloads') {
      // ONLY actual file/folder downloads!
      combined = actualDownloads;
    } else if (filter === 'requests') {
      // ONLY pending permission requests!
      combined = requests;
    } else {
      // All Activity: Downloads, Security/Password changes, Messages, Requests!
      combined = [...requests, ...securityActivities, ...messages, ...actualDownloads];
    }

    combined.sort((a, b) => b.timestamp - a.timestamp);

    unifiedNotifList.innerHTML = '';

    if (combined.length === 0) {
      let emptyMsg = 'No notifications or activity recorded yet.';
      if (filter === 'downloads') emptyMsg = 'No download records yet.';
      if (filter === 'requests') emptyMsg = 'No pending permission requests.';
      unifiedNotifList.innerHTML = `<div style="color: var(--text-muted); font-size: 12px; padding: 32px 16px; text-align: center; font-style: italic;">${emptyMsg}</div>`;
      return;
    }

    combined.forEach(entry => {
      if (entry.kind === 'request') {
        const req = entry.item;
        const card = document.createElement('div');
        card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); border-left: 3px solid var(--accent-orange); gap: 12px;';

        const senderDisplay = req.name ? `${escapeHtml(req.name)} (@${escapeHtml(req.username)})` : `@${escapeHtml(req.username)}`;

        card.innerHTML = `
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
              <span class="conn-net-badge" style="background: rgba(255, 159, 10, 0.15); color: var(--accent-orange); border-color: rgba(255, 159, 10, 0.3); font-size: 10px;">Permission Request</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${senderDisplay}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-primary);">
              Requested access: <strong style="color: var(--accent-blue);">${escapeHtml(req.permissionLabel)}</strong>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">
              ${formatDate(req.createdAt)}
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-shrink: 0;">
            <button class="btn btn-primary btn-sm notif-approve-btn" style="background: var(--accent-green); border-color: var(--accent-green); padding: 4px 10px; font-size: 11px;">Approve</button>
            <button class="btn btn-secondary btn-sm notif-decline-btn" style="padding: 4px 10px; font-size: 11px;">Decline</button>
          </div>
        `;

        card.querySelector('.notif-approve-btn').onclick = async () => {
          try {
            const ares = await fetch('/api/requests/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestId: req.id })
            });
            const adata = await ares.json();
            if (adata.success) {
              showToast(`Approved "${req.permissionLabel}" for ${senderDisplay}`);
              loadAdminNotifications(activeNotifTab);
              loadPendingRequests();
              loadGuests();
              updateNotificationsSummary();
            } else {
              showToast(adata.error || 'Failed to approve');
            }
          } catch (e) {
            showToast(e.message);
          }
        };

        card.querySelector('.notif-decline-btn').onclick = async () => {
          try {
            const dres = await fetch('/api/requests/decline', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requestId: req.id })
            });
            const ddata = await dres.json();
            if (ddata.success) {
              showToast(`Declined request from ${senderDisplay}`);
              loadAdminNotifications(activeNotifTab);
              loadPendingRequests();
              updateNotificationsSummary();
            } else {
              showToast(ddata.error || 'Failed to decline');
            }
          } catch (e) {
            showToast(e.message);
          }
        };

        unifiedNotifList.appendChild(card);
      } else if (entry.kind === 'security') {
        const act = entry.item;
        const card = document.createElement('div');
        const isUnread = !act.read;
        card.style.cssText = `display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 14px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); ${isUnread ? 'border-left: 3px solid var(--accent-orange);' : ''} gap: 12px;`;

        const userDisplay = act.name ? `${escapeHtml(act.name)} (@${escapeHtml(act.username || 'user')})` : `@${escapeHtml(act.username || 'user')}`;
        const roleBadge = act.role === 'admin'
          ? '<span class="role-badge admin" style="font-size: 10px;">Admin</span>'
          : '<span class="role-badge guest" style="font-size: 10px;">Guest</span>';

        card.innerHTML = `
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
              <span class="conn-net-badge" style="background: rgba(255, 159, 10, 0.15); color: var(--accent-orange); font-size: 10px; border-color: rgba(255, 159, 10, 0.3);">Security</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${userDisplay}</span>
              ${roleBadge}
              ${isUnread ? '<span class="conn-net-badge" style="background: rgba(255, 69, 58, 0.15); color: var(--accent-red); font-size: 10px; border-color: rgba(255, 69, 58, 0.3);">New</span>' : ''}
            </div>
            <div style="font-size: 12px; color: var(--text-primary); margin-top: 2px;">
              ${escapeHtml(act.actionText || 'Guest updated their account password.')}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
              ${formatDate(act.timestamp || act.downloadedAt)}
            </div>
          </div>
          ${isUnread ? `
            <div style="flex-shrink: 0;">
              <button type="button" class="btn btn-secondary btn-sm notif-read-item-btn" style="padding: 3px 8px; font-size: 11px;">Mark Read</button>
            </div>
          ` : ''}
        `;

        const readItemBtn = card.querySelector('.notif-read-item-btn');
        if (readItemBtn) {
          readItemBtn.onclick = async () => {
            try {
              await fetch('/api/notifications/downloads/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ downloadId: act.id })
              });
              loadAdminNotifications(activeNotifTab);
              updateNotificationsSummary();
            } catch (e) {}
          };
        }

        unifiedNotifList.appendChild(card);
      } else if (entry.kind === 'message') {
        const msg = entry.item;
        const card = document.createElement('div');
        const isUnread = !msg.read && (!msg.readBy || !msg.readBy.includes('admin'));
        card.style.cssText = `display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 14px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); ${isUnread ? 'border-left: 3px solid var(--accent-green);' : ''} gap: 12px;`;

        const userDisplay = msg.senderName ? `${escapeHtml(msg.senderName)} (@${escapeHtml(msg.senderUsername || 'user')})` : `@${escapeHtml(msg.senderUsername || 'user')}`;
        const roleBadge = msg.senderRole === 'admin'
          ? '<span class="role-badge admin" style="font-size: 10px;">Admin</span>'
          : '<span class="role-badge guest" style="font-size: 10px;">Guest</span>';

        card.innerHTML = `
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
              <span class="conn-net-badge" style="background: rgba(48, 209, 88, 0.15); color: var(--accent-green); font-size: 10px; border-color: rgba(48, 209, 88, 0.3);">Chat Message</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${userDisplay}</span>
              ${roleBadge}
              ${isUnread ? '<span class="conn-net-badge" style="background: rgba(255, 69, 58, 0.15); color: var(--accent-red); font-size: 10px; border-color: rgba(255, 69, 58, 0.3);">New</span>' : ''}
            </div>
            <div style="font-size: 12px; color: var(--text-primary); margin-top: 2px; word-break: break-word;">
              ${escapeHtml(msg.message || msg.text || '')}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
              ${formatDate(msg.createdAt)}
            </div>
          </div>
          <div style="flex-shrink: 0; display: flex; gap: 6px; align-items: center;">
            <button type="button" class="btn btn-primary btn-sm notif-reply-msg-btn" style="padding: 3px 8px; font-size: 11px;">Reply</button>
            ${isUnread ? `
              <button type="button" class="btn btn-secondary btn-sm notif-read-msg-btn" style="padding: 3px 8px; font-size: 11px;">Mark Read</button>
            ` : ''}
          </div>
        `;

        const replyBtn = card.querySelector('.notif-reply-msg-btn');
        if (replyBtn) {
          replyBtn.onclick = () => {
            closeNotifModal();
            openMessagesModal(msg.senderId || msg.senderUsername);
          };
        }

        const readMsgBtn = card.querySelector('.notif-read-msg-btn');
        if (readMsgBtn) {
          readMsgBtn.onclick = async () => {
            try {
              await fetch('/api/messages/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: msg.id })
              });
              loadAdminNotifications(activeNotifTab);
              updateNotificationsSummary();
            } catch (e) {}
          };
        }

        unifiedNotifList.appendChild(card);
      } else if (entry.kind === 'download') {
        const dl = entry.item;
        const card = document.createElement('div');
        const isUnread = !dl.read;
        card.style.cssText = `display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 14px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); ${isUnread ? 'border-left: 3px solid var(--accent-blue);' : ''} gap: 12px;`;

        const userDisplay = dl.name ? `${escapeHtml(dl.name)} (@${escapeHtml(dl.username || 'user')})` : `@${escapeHtml(dl.username || 'user')}`;
        const roleBadge = dl.role === 'admin'
          ? '<span class="role-badge admin" style="font-size: 10px;">Admin</span>'
          : '<span class="role-badge guest" style="font-size: 10px;">Guest</span>';

        const typeLabel = dl.isDirectory ? 'Folder (ZIP)' : 'File';
        const sizeStr = formatBytes(dl.fileSize || 0);
        const fileName = dl.fileName || (dl.filePath ? dl.filePath.split(/[/\\]/).filter(Boolean).pop() : 'Download');

        card.innerHTML = `
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
              <span class="conn-net-badge" style="background: rgba(10, 132, 255, 0.15); color: var(--accent-blue); font-size: 10px; border-color: rgba(10, 132, 255, 0.3);">${typeLabel} Downloaded</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${userDisplay}</span>
              ${roleBadge}
              ${isUnread ? '<span class="conn-net-badge" style="background: rgba(255, 159, 10, 0.15); color: var(--accent-orange); font-size: 10px; border-color: rgba(255, 159, 10, 0.3);">Unread</span>' : ''}
            </div>
            <div style="font-size: 13px; font-weight: 600; color: var(--accent-blue); font-family: monospace; word-break: break-all; margin-top: 4px;" title="${escapeHtml(dl.filePath || '')}">
              ${escapeHtml(fileName)}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap;">
              <span><strong>Size:</strong> ${sizeStr}</span>
              <span>&bull;</span>
              <span><strong>Time:</strong> ${formatDate(dl.timestamp || dl.downloadedAt)}</span>
              ${dl.filePath ? `<span>&bull;</span><span style="word-break: break-all;"><strong>Path:</strong> ${escapeHtml(dl.filePath)}</span>` : ''}
            </div>
          </div>
          ${isUnread ? `
            <div style="flex-shrink: 0;">
              <button type="button" class="btn btn-secondary btn-sm notif-read-item-btn" style="padding: 3px 8px; font-size: 11px;">Mark Read</button>
            </div>
          ` : ''}
        `;

        const readItemBtn = card.querySelector('.notif-read-item-btn');
        if (readItemBtn) {
          readItemBtn.onclick = async () => {
            try {
              await fetch('/api/notifications/downloads/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ downloadId: dl.id })
              });
              loadAdminNotifications(activeNotifTab);
              updateNotificationsSummary();
            } catch (e) {}
          };
        }

        unifiedNotifList.appendChild(card);
      }
    });
  } catch (err) {
    console.error('loadAdminNotifications error:', err);
  }
}

if (notifBtn) notifBtn.onclick = () => openNotifModal('all');
if (notifCloseBtn) notifCloseBtn.onclick = closeNotifModal;
if (notifTabAllBtn) notifTabAllBtn.onclick = () => switchNotifTab('all');
if (notifTabDownloadsBtn) notifTabDownloadsBtn.onclick = () => switchNotifTab('downloads');
if (notifTabReqBtn) notifTabReqBtn.onclick = () => switchNotifTab('requests');
if (markAllNotifsReadBtn) {
  markAllNotifsReadBtn.onclick = async () => {
    try {
      if (currentUser?.role === 'admin') {
        await Promise.all([
          fetch('/api/notifications/downloads/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          }),
          fetch('/api/messages/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true })
          })
        ]);
        showToast('All activity notifications marked as read');
        loadAdminNotifications(activeNotifTab);
        updateNotificationsSummary();
      } else {
        await fetch('/api/notifications/requests/read', { method: 'POST' });
        showToast('All notifications marked as read');
        loadGuestNotifications();
        updateNotificationsSummary();
      }
    } catch (err) {
      showToast(err.message);
    }
  };
}

// Dedicated Messages & Chat Management
let cachedChatMessages = [];
let activeReplyMessageId = null;

function openMessagesModal(recipientId = null) {
  if (!messagesModal) return;
  messagesModal.classList.add('active');
  loadChatRecipients().then(() => {
    if (recipientId && chatRecipientSelect) {
      chatRecipientSelect.value = recipientId;
      if (chatMessageInput) chatMessageInput.focus();
    }
  });
  loadChatMessages(true);
  updateNotificationsSummary();
}

function closeMessagesModal() {
  if (messagesModal) messagesModal.classList.remove('active');
}

if (messagesBtn) messagesBtn.onclick = () => openMessagesModal();
if (messagesCloseBtn) messagesCloseBtn.onclick = closeMessagesModal;

async function updateNotificationsSummary() {
  try {
    const res = await fetch('/api/notifications/summary');
    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    // Notifications Badge (Bell Icon)
    const notifCount = data.totalNotifications || 0;
    if (notifBadgeCount) {
      if (notifCount > 0) {
        notifBadgeCount.textContent = notifCount > 99 ? '99+' : notifCount;
        notifBadgeCount.style.display = 'inline-flex';
      } else {
        notifBadgeCount.style.display = 'none';
      }
    }

    // Messages Badge (Chat Bubble Icon)
    const msgCount = data.unreadMessagesCount || 0;
    if (messagesBadgeCount) {
      if (msgCount > 0) {
        messagesBadgeCount.textContent = msgCount > 99 ? '99+' : msgCount;
        messagesBadgeCount.style.display = 'inline-flex';
      } else {
        messagesBadgeCount.style.display = 'none';
      }
    }

    if (notifAllCountPill) {
      if (notifCount > 0) {
        notifAllCountPill.textContent = notifCount;
        notifAllCountPill.style.display = 'inline-flex';
      } else {
        notifAllCountPill.style.display = 'none';
      }
    }

    if (notifReqCountPill) {
      const pCount = data.pendingRequestsCount || 0;
      if (pCount > 0) {
        notifReqCountPill.textContent = pCount;
        notifReqCountPill.style.display = 'inline-flex';
      } else {
        notifReqCountPill.style.display = 'none';
      }
    }

    if (notifDownloadsCountPill) {
      const dCount = data.unreadDownloadsCount || 0;
      if (dCount > 0) {
        notifDownloadsCountPill.textContent = dCount;
        notifDownloadsCountPill.style.display = 'inline-flex';
      } else {
        notifDownloadsCountPill.style.display = 'none';
      }
    }
  } catch (err) {}
}

async function loadChatRecipients() {
  if (!chatRecipientSelect) return;
  try {
    const res = await fetch('/api/messages/recipients');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    const currentVal = chatRecipientSelect.value;
    chatRecipientSelect.innerHTML = '<option value="all">Everyone (Public Server Chat)</option>';

    (data.recipients || []).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.label || (r.name ? `${r.name} (@${r.username})` : `@${r.username}`);
      chatRecipientSelect.appendChild(opt);
    });

    if (currentVal && Array.from(chatRecipientSelect.options).some(o => o.value === currentVal)) {
      chatRecipientSelect.value = currentVal;
    }
  } catch (err) {}
}

async function loadChatMessages(forceScroll = false) {
  if (!chatMessagesList) return;
  try {
    const res = await fetch('/api/messages');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    cachedChatMessages = data.messages || [];
    renderChatMessages(forceScroll);
  } catch (err) {}
}

function renderChatMessages(forceScroll = false) {
  if (!chatMessagesList) return;
  const wasNearBottom = (chatMessagesList.scrollHeight - chatMessagesList.scrollTop - chatMessagesList.clientHeight) < 120;
  const filter = chatConversationFilter ? chatConversationFilter.value : 'all';

  let list = cachedChatMessages;
  if (filter === 'public') {
    list = cachedChatMessages.filter(m => m.recipientId === 'all');
  } else if (filter === 'direct') {
    list = cachedChatMessages.filter(m => m.recipientId !== 'all');
  }

  chatMessagesList.innerHTML = '';

  if (list.length === 0) {
    chatMessagesList.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px 12px; font-style: italic;">No messages found. Send a message to start conversation!</div>';
    return;
  }

  list.forEach(m => {
    const isMine = (m.senderId && currentUser?.id && String(m.senderId) === String(currentUser.id)) ||
                   (currentUser?.role === 'admin' && m.senderRole === 'admin');

    const card = document.createElement('div');
    const isUnread = !m.read && !isMine;
    card.className = `chat-card ${isMine ? 'sent-by-me' : ''} ${isUnread ? 'unread' : ''}`;

    let targetBadge = '';
    if (m.recipientId === 'all') {
      targetBadge = '<span class="chat-target-badge public">Public Chat</span>';
    } else {
      if (isMine) {
        const recName = m.recipientName || m.recipientUsername || 'user';
        targetBadge = `<span class="chat-target-badge direct">Direct to @${escapeHtml(m.recipientUsername || recName)}</span>`;
      } else {
        targetBadge = '<span class="chat-target-badge direct">Direct message</span>';
      }
    }

    const senderDisplay = m.senderName ? `${escapeHtml(m.senderName)} (@${escapeHtml(m.senderUsername)})` : `@${escapeHtml(m.senderUsername)}`;
    const roleBadge = m.senderRole === 'admin'
      ? '<span class="role-badge admin">Admin</span>'
      : '<span class="role-badge guest">Guest</span>';

    const unreadIndicator = isUnread
      ? '<span class="conn-net-badge" style="background: rgba(255, 159, 10, 0.15); color: var(--accent-orange); border-color: rgba(255, 159, 10, 0.3); font-size: 10px;">New</span>'
      : '';

    let actionsHtml = '';
    if (!isMine) {
      actionsHtml += `<button type="button" class="btn btn-secondary btn-sm reply-msg-btn" style="padding: 2px 8px; font-size: 11px;">Reply</button>`;
      if (isUnread) {
        actionsHtml += `<button type="button" class="btn btn-secondary btn-sm read-msg-btn" style="padding: 2px 8px; font-size: 11px;">Mark Read</button>`;
      }
    }
    if (isMine || currentUser?.role === 'admin') {
      actionsHtml += `<button type="button" class="btn btn-danger btn-sm del-msg-btn" style="padding: 2px 8px; font-size: 11px;">Delete</button>`;
    }

    card.innerHTML = `
      <div class="chat-card-header">
        <div class="chat-card-user">
          <span>${senderDisplay}</span>
          ${roleBadge}
          ${targetBadge}
          ${unreadIndicator}
        </div>
        <span style="font-size: 11px; color: var(--text-secondary); flex-shrink: 0;">${formatDate(m.createdAt)}</span>
      </div>
      <div class="chat-card-text">${escapeHtml(m.text || m.message || '')}</div>
      ${actionsHtml ? `<div class="chat-card-actions">${actionsHtml}</div>` : ''}
    `;

    const replyBtn = card.querySelector('.reply-msg-btn');
    if (replyBtn) {
      replyBtn.onclick = () => {
        activeReplyMessageId = m.id;
        const targetRecipientId = m.senderRole === 'admin' ? 'admin' : m.senderId;
        if (chatRecipientSelect) {
          chatRecipientSelect.value = targetRecipientId;
        }
        if (chatMessageInput) {
          chatMessageInput.focus();
          chatMessageInput.placeholder = `Replying to @${m.senderUsername}...`;
        }
      };
    }

    const readBtn = card.querySelector('.read-msg-btn');
    if (readBtn) {
      readBtn.onclick = async () => {
        try {
          await fetch('/api/messages/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: m.id })
          });
          await loadChatMessages();
          updateNotificationsSummary();
        } catch (e) {
          showToast(e.message);
        }
      };
    }

    const delBtn = card.querySelector('.del-msg-btn');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (confirm('Delete this message?')) {
          try {
            const res = await fetch('/api/messages/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messageId: m.id })
            });
            const data = await res.json();
            if (data.success) {
              showToast('Message deleted');
              await loadChatMessages();
              updateNotificationsSummary();
            } else {
              showToast(data.error || 'Failed to delete message');
            }
          } catch (e) {
            showToast(e.message);
          }
        }
      };
    }

    chatMessagesList.appendChild(card);
  });

  if (forceScroll || wasNearBottom) {
    chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  }
}

if (chatConversationFilter) {
  chatConversationFilter.onchange = () => {
    renderChatMessages(true);
  };
}

if (markAllMessagesReadBtn) {
  markAllMessagesReadBtn.onclick = async () => {
    try {
      const res = await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
      });
      const data = await res.json();
      if (data.success) {
        showToast('All messages marked as read');
        await loadChatMessages();
        updateNotificationsSummary();
      }
    } catch (e) {
      showToast(e.message);
    }
  };
}

if (chatSendMessageForm) {
  chatSendMessageForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!chatMessageInput) return;
    const text = chatMessageInput.value.trim();
    if (!text) return;
    const recipientId = chatRecipientSelect ? chatRecipientSelect.value : 'all';
    const repliedMsgId = activeReplyMessageId;

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, text, replyToMessageId: repliedMsgId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Message sent');
        chatMessageInput.value = '';
        chatMessageInput.placeholder = 'Type your message here...';

        if (repliedMsgId) {
          try {
            await fetch('/api/messages/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messageId: repliedMsgId })
            });
          } catch (e) {}
          activeReplyMessageId = null;
        }

        await loadChatMessages(true);
        updateNotificationsSummary();
      } else {
        showToast(data.error || 'Failed to send message');
      }
    } catch (err) {
      showToast(err.message);
    }
  };
}

// Editor listeners
editorCloseBtn.onclick = () => editorModal.classList.remove('active');
editorSaveBtn.onclick = saveCurrentFile;
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    if (editorModal.classList.contains('active')) {
      e.preventDefault();
      saveCurrentFile();
    }
  }
  if (e.key === 'Escape') {
    if (editorModal) editorModal.classList.remove('active');
    closeMediaPreview();
    if (settingsModal) settingsModal.classList.remove('active');
    if (notifModal) notifModal.classList.remove('active');
    if (messagesModal) messagesModal.classList.remove('active');
    closeEditGuestModal();
    closePrompt();
    closeItemActionSheet();
    closeMobileSidebar();
  }
});

previewCloseBtn.onclick = closeMediaPreview;

// Mobile bottom bar buttons
const mobileConnectionsBtn = document.getElementById('mobileConnectionsBtn');
if (mobileConnectionsBtn) {
  mobileConnectionsBtn.onclick = () => openSettings('connections');
}
const mobilePermsBtn = document.getElementById('mobilePermsBtn');
if (mobilePermsBtn) {
  mobilePermsBtn.onclick = () => openSettings('permissions');
}
if (mobileQrBtn) {
  mobileQrBtn.onclick = () => openSettings('remote');
}

// Mobile sidebar drawer
menuToggleBtn.onclick = () => {
  appSidebar.classList.toggle('open');
  sidebarBackdrop.classList.toggle('active');
};
sidebarBackdrop.onclick = closeMobileSidebar;

// Initialize
async function init() {
  await checkAuth();
  await updateMetrics();
  await updateTunnelStatus();
  await loadDirectory();
  await updateNotificationsSummary();

  if (currentUser?.role === 'admin') {
    loadConnections();
    loadPendingRequests();
  } else {
    loadGuestPermissions();
  }

  setInterval(updateMetrics, 10000);
  setInterval(updateTunnelStatus, 8000);
  setInterval(updateNotificationsSummary, 6000);
  setInterval(() => {
    if (currentUser?.role === 'admin') {
      loadConnections();
      loadPendingRequests();
    }
  }, 6000);
  setInterval(() => {
    if (notifModal && notifModal.classList.contains('active')) {
      if (currentUser?.role === 'admin') {
        loadAdminNotifications(activeNotifTab);
      } else {
        loadGuestNotifications();
      }
    }
    if (messagesModal && messagesModal.classList.contains('active')) {
      loadChatMessages();
    }
  }, 4000);
}

init();
