export interface SocketPresence {
  userId: string;
  workspaceId: string;
  status: 'online' | 'away' | 'offline';
  lastSeenAt: string | null;
}

export interface SocketPresenceSnapshot {
  onlineUserIds: string[];
}
