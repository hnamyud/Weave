// ─── Event catalogue ──────────────────────────────────────────────────────────

export const EVENTS = {
  // Client → Server
  JOIN_WORKSPACE: 'workspace:join',
  JOIN_CONVERSATION: 'conversation:join',
  LEAVE_CONVERSATION: 'conversation:leave',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  PRESENCE_JOIN: 'presence:join',

  // Server → Client
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',

  REACTION_ADDED: 'reaction:added',
  REACTION_REMOVED: 'reaction:removed',

  CONVERSATION_UPDATED: 'conversation:updated',
  CONVERSATION_DELETED: 'conversation:deleted',
  WORKSPACE_DELETED: 'workspace:deleted',
  MEMBER_JOINED: 'member:joined',
  MEMBER_LEFT: 'member:left',

  TYPING: 'typing', // broadcasted typing indicator

  NOTIFICATION_NEW: 'notification:new',

  USER_PRESENCE: 'user:presence', // online/offline/away
  PRESENCE_SNAPSHOT: 'presence:snapshot', // snapshot of online users on join

  PINNED_MESSAGE_ADDED: 'pinned:added',
  PINNED_MESSAGE_REMOVED: 'pinned:removed',
} as const;
