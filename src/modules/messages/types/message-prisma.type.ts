import type { Prisma } from '@prisma/client';
import {
  baseMessageInclude,
  buildAttachmentPermissionSelect,
  buildMessageWithPermissionInclude,
  conversationMembershipSelect,
} from '../message.prisma-select';

export type MessageRecord = Prisma.MessageGetPayload<{
  include: typeof baseMessageInclude;
}>;

export type MessageWithPermissionContext = Prisma.MessageGetPayload<{
  include: ReturnType<typeof buildMessageWithPermissionInclude>;
}>;

export type ConversationMembership = Prisma.ConversationMemberGetPayload<{
  select: typeof conversationMembershipSelect;
}>;

export type AttachmentPermissionRecord = Prisma.AttachmentGetPayload<{
  select: ReturnType<typeof buildAttachmentPermissionSelect>;
}>;
