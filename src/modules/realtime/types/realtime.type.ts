import type { SocketAttachment } from '../../../shared/interfaces/socket-attachment.interface';
import type { SocketUser } from '../../../shared/interfaces/socket-user.interface';

export type RealtimeMessageInput = {
  id: string;
  conversationId: string;
  parentId: string | null;
  content: string | null;
  isEdited: boolean;
  editedAt: Date | string | null;
  createdAt: Date | string;
  sender: SocketUser | null;
  attachments: SocketAttachment[];
  replyCount: number;
};

export type RealtimeNotificationInput = {
  id: string;
  userId: string;
  actorId: string | null;
  workspaceId: string;
  conversationId: string | null;
  messageId: string | null;
  type: string;
  payload: unknown;
  createdAt: Date | string;
};

export type RealtimePinnedMessageInput = {
  conversationId: string;
  messageId: string;
  pinnedBy: string;
};
