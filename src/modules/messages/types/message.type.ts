import type { FileMetadataDto } from '../../files/dto/file-metadata.dto';

export type MessageCursor = {
  createdAt: string;
  id: string;
};

export type MessageWriteInput = {
  conversationId: string;
  parentId?: string;
  content?: string;
  attachments?: FileMetadataDto[];
  mentionedUserIds?: string[];
};

export type MessageSenderResponse = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type MessageParentResponse = {
  id: string;
  senderId: string | null;
  content: string | null;
  createdAt: Date;
};

export type MessageAttachmentResponse = {
  id: string;
  fileName: string;
  storageKey: string;
  fileHash: string;
  fileType: string | null;
  fileSize: number | null;
};

export type MessageResponse = {
  id: string;
  conversationId: string;
  senderId: string | null;
  parentId: string | null;
  content: string | null;
  isEdited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sender: MessageSenderResponse | null;
  parent: MessageParentResponse | null;
  attachments: MessageAttachmentResponse[];
  replyCount: number;
};

export type MessageCursorResponse = {
  result: MessageResponse[];
  nextCursor: string | null;
};
