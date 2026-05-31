import { SocketAttachment } from './socket-attachment.interface';
import { SocketUser } from './socket-user.interface';

export interface SocketMessage {
  id: string;
  conversationId: string;
  parentId: string | null;
  content: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  sender: SocketUser | null;
  attachments: SocketAttachment[];
  replyCount: number;
}

export interface SocketPinnedMessage {
  conversationId: string;
  messageId: string;
  pinnedBy: string;
}
