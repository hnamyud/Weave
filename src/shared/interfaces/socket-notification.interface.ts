export interface SocketNotification {
  id: string;
  type: string;
  workspaceId: string;
  conversationId: string | null;
  messageId: string | null;
  actorId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}
