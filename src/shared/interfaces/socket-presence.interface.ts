export interface SocketPresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeenAt: string | null;
}
