import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MESSAGES_FILE = path.join(process.cwd(), 'data', 'messages.json');

function ensureMessagesFile() {
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

export function loadMessages() {
  ensureMessagesFile();
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export function saveMessages(messages) {
  ensureMessagesFile();
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8');
}

export function createMessage(sender, recipient, text) {
  const cleanText = (text || '').trim();
  if (!cleanText) {
    throw new Error('Message cannot be empty.');
  }

  const senderId = sender?.id || sender?.username || 'user';
  const senderUsername = sender?.username || 'user';
  const senderName = sender?.name || senderUsername;
  const senderRole = sender?.role || 'guest';

  let recipientId = recipient?.id || 'admin';
  let recipientUsername = recipient?.username || (recipientId === 'admin' ? 'admin' : (recipientId === 'all' ? 'everyone' : recipientId));
  let recipientName = recipient?.name || (recipientId === 'admin' ? 'Server Administrator' : (recipientId === 'all' ? 'Everyone (Public)' : recipientUsername));

  if (recipientId === 'all') {
    recipientUsername = 'everyone';
    recipientName = 'Everyone (Public)';
  } else if (recipientId === 'admin') {
    recipientUsername = 'admin';
    recipientName = 'Server Administrator';
  }

  const messages = loadMessages();
  const newMsg = {
    id: 'msg_' + crypto.randomBytes(6).toString('hex'),
    senderId,
    senderUsername,
    senderName,
    senderRole,
    recipientId,
    recipientUsername,
    recipientName,
    message: cleanText,
    text: cleanText,
    readBy: [senderId, senderUsername],
    read: false,
    createdAt: new Date().toISOString()
  };

  messages.push(newMsg);
  saveMessages(messages);
  return newMsg;
}

export function getMessagesForUser(user) {
  const messages = loadMessages();
  if (!user) return [];

  const isAdmin = user.role === 'admin';
  const userId = user.id || user.username;
  const username = (user.username || '').toLowerCase();

  return messages
    .filter(m => {
      if (isAdmin) return true;
      if (m.recipientId === 'all') return true;
      const mSenderId = (m.senderId || '').toLowerCase();
      const mSenderUser = (m.senderUsername || '').toLowerCase();
      const mRecipId = (m.recipientId || '').toLowerCase();
      const mRecipUser = (m.recipientUsername || '').toLowerCase();

      return mSenderId === userId || mSenderUser === username || mRecipId === userId || mRecipUser === username;
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // chronological order for chat feed
}

export function markMessageAsRead(messageId, user) {
  const messages = loadMessages();
  const msg = messages.find(m => m.id === messageId);
  if (!msg) return { success: false, error: 'Message not found' };

  if (!Array.isArray(msg.readBy)) {
    msg.readBy = [];
  }

  const userId = user?.id || user?.username || 'user';
  const username = user?.username || 'user';

  if (!msg.readBy.includes(userId)) msg.readBy.push(userId);
  if (!msg.readBy.includes(username)) msg.readBy.push(username);
  msg.read = true;

  saveMessages(messages);
  return { success: true, message: msg };
}

export function markAllMessagesAsRead(user) {
  const messages = loadMessages();
  const userId = user?.id || user?.username || 'user';
  const username = user?.username || 'user';
  const isAdmin = user?.role === 'admin';

  for (const msg of messages) {
    if (!Array.isArray(msg.readBy)) msg.readBy = [];
    const isVisible = isAdmin || msg.recipientId === 'all' || msg.recipientId === userId || msg.recipientUsername === username;
    if (isVisible) {
      if (!msg.readBy.includes(userId)) msg.readBy.push(userId);
      if (!msg.readBy.includes(username)) msg.readBy.push(username);
      msg.read = true;
    }
  }

  saveMessages(messages);
  return { success: true };
}

export function deleteMessage(messageId, user) {
  const messages = loadMessages();
  const index = messages.findIndex(m => m.id === messageId);
  if (index === -1) {
    return { success: false, error: 'Message not found' };
  }

  const msg = messages[index];
  const isAdmin = user?.role === 'admin';
  const isSender = msg.senderId === user?.id || msg.senderUsername === user?.username;

  if (!isAdmin && !isSender) {
    throw new Error('You do not have permission to delete this message.');
  }

  messages.splice(index, 1);
  saveMessages(messages);
  return { success: true };
}

export function getUnreadMessagesCount(user) {
  if (!user) return 0;
  const messages = loadMessages();
  const userId = user.id || user.username;
  const username = (user.username || '').toLowerCase();
  const isAdmin = user.role === 'admin';

  return messages.filter(m => {
    // Senders don't have unread on their own messages
    if (m.senderId === userId || (m.senderUsername || '').toLowerCase() === username) {
      return false;
    }

    const readList = Array.isArray(m.readBy) ? m.readBy.map(r => String(r).toLowerCase()) : [];
    if (readList.includes(String(userId).toLowerCase()) || readList.includes(username)) {
      return false;
    }

    if (isAdmin) {
      return m.recipientId === 'all' || m.recipientId === 'admin' || (m.recipientUsername || '').toLowerCase() === 'admin';
    } else {
      return m.recipientId === 'all' || m.recipientId === userId || (m.recipientUsername || '').toLowerCase() === username;
    }
  }).length;
}

export function getChatRecipients(currentUser, allGuests = []) {
  const recipients = [
    { id: 'all', username: 'everyone', name: 'Everyone (Public Server Chat)', label: 'Everyone (Public Server Chat)' }
  ];

  if (currentUser?.role !== 'admin') {
    recipients.push({ id: 'admin', username: 'admin', name: 'Server Administrator', label: 'Server Administrator (@admin)' });
  }

  const myId = currentUser?.id;
  const myUser = (currentUser?.username || '').toLowerCase();

  allGuests.forEach(g => {
    if (g.id !== myId && (g.username || '').toLowerCase() !== myUser) {
      recipients.push({
        id: g.id,
        username: g.username,
        name: g.name || g.username,
        label: g.name ? `${g.name} (@${g.username})` : `@${g.username}`
      });
    }
  });

  return recipients;
}
