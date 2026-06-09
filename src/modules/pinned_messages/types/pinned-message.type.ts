import { Prisma } from '@prisma/client';
import { baseMessageInclude } from 'src/modules/messages/message.prisma-select';
import { MessageResponse } from 'src/modules/messages/types/message.type';

export type PinnedMessageCursor = {
  createdAt: string;
  id: string;
};

export type PinnedMessageRecord = Prisma.PinnedMessageGetPayload<{
  include: {
    message: {
      include: typeof baseMessageInclude;
    };
  };
}>;

export type PinnedMessageResponse = {
  id: string;
  conversationId: string;
  messageId: string;
  pinnedBy: string;
  createdAt: Date;
  message: MessageResponse;
};

export type PinnedMessageCursorResponse = {
  result: PinnedMessageResponse[];
  nextCursor: string | null;
};
