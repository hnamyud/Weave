import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';
import { MessageCursorQueryDto } from '../messages/dto/message-cursor-query.dto';
import { baseMessageInclude } from '../messages/message.prisma-select';
import { RealtimeService } from '../realtime/realtime.service';
import {
  PinnedMessageCursor,
  PinnedMessageCursorResponse,
  PinnedMessageRecord,
  PinnedMessageResponse,
} from './types/pinned-message.type';

@Injectable()
export class PinnedMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async pinMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        isDeleted: false,
        conversation: {
          isDeleted: false,
          workspace: {
            isDeleted: false,
            members: {
              some: { userId, leftAt: null },
            },
          },
          members: {
            some: { userId, leftAt: null },
          },
        },
      },
      include: {
        conversation: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.conversation.isArchived) {
      throw new BadRequestException('Conversation is archived');
    }

    const pinnedMessage = await this.prisma.pinnedMessage.upsert({
      where: { messageId },
      update: {},
      create: {
        id: uuidv7(),
        messageId,
        conversationId: message.conversationId,
        pinnedBy: userId,
      },
    });

    this.realtimeService.emitPinnedMessageAdded({
      conversationId: pinnedMessage.conversationId,
      messageId: pinnedMessage.messageId,
      pinnedBy: pinnedMessage.pinnedBy,
    });

    return pinnedMessage;
  }

  async unpinMessage(messageId: string, userId: string) {
    const pinnedMessage = await this.prisma.pinnedMessage.findFirst({
      where: {
        messageId,
        message: {
          isDeleted: false,
          conversation: {
            isDeleted: false,
            workspace: {
              isDeleted: false,
              members: { some: { userId, leftAt: null } },
            },
            members: { some: { userId, leftAt: null } },
          },
        },
      },
    });

    if (!pinnedMessage) {
      throw new NotFoundException('Pinned message not found');
    }

    const deletedPinnedMessage = await this.prisma.pinnedMessage.delete({
      where: { messageId },
    });

    this.realtimeService.emitPinnedMessageRemoved({
      conversationId: pinnedMessage.conversationId,
      messageId: pinnedMessage.messageId,
      pinnedBy: pinnedMessage.pinnedBy,
    });

    return deletedPinnedMessage;
  }

  async getPinnedMessages(
    conversationId: string,
    userId: string,
    query: MessageCursorQueryDto,
  ): Promise<PinnedMessageCursorResponse> {
    await this.ensureConversationMember(conversationId, userId);

    const limit = this.getCursorPageLimit(query.limit);
    const cursor = this.decodeCursor(query.cursor);
    const pinnedMessages = await this.prisma.pinnedMessage.findMany({
      where: {
        conversationId,
        message: {
          isDeleted: false,
        },
        ...(cursor ? this.buildOlderThanCursorWhere(cursor) : {}),
      },
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        message: {
          include: baseMessageInclude,
        },
      },
    });

    return this.buildCursorResponse(pinnedMessages, limit);
  }

  private async ensureConversationMember(
    conversationId: string,
    userId: string,
  ) {
    const member = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null,
        conversation: {
          isDeleted: false,
          workspace: {
            isDeleted: false,
            members: {
              some: {
                userId,
                leftAt: null,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'User is not an active member of this conversation',
      );
    }
  }

  private getCursorPageLimit(limit?: number) {
    const pageSize = parsePositiveInteger(limit, 30, 'limit');

    if (pageSize > 100) {
      throw new BadRequestException('limit must not be greater than 100');
    }

    return pageSize;
  }

  private encodeCursor(pinnedMessage: { createdAt: Date; id: string }) {
    return Buffer.from(
      JSON.stringify({
        createdAt: pinnedMessage.createdAt.toISOString(),
        id: pinnedMessage.id,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor?: string): PinnedMessageCursor | null {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as PinnedMessageCursor;

      if (
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string'
      ) {
        throw new Error('Invalid cursor payload');
      }

      return decoded;
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private buildOlderThanCursorWhere(
    cursor: PinnedMessageCursor,
  ): Prisma.PinnedMessageWhereInput {
    return {
      OR: [
        {
          createdAt: {
            lt: new Date(cursor.createdAt),
          },
        },
        {
          createdAt: new Date(cursor.createdAt),
          id: {
            lt: cursor.id,
          },
        },
      ],
    };
  }

  private buildCursorResponse(
    pinnedMessages: PinnedMessageRecord[],
    limit: number,
  ): PinnedMessageCursorResponse {
    const result = pinnedMessages.map((pinnedMessage) =>
      this.mapPinnedMessageResponse(pinnedMessage),
    );
    const nextCursor =
      pinnedMessages.length === limit
        ? this.encodeCursor(pinnedMessages[pinnedMessages.length - 1])
        : null;

    return {
      result,
      nextCursor,
    };
  }

  private mapPinnedMessageResponse(
    pinnedMessage: PinnedMessageRecord,
  ): PinnedMessageResponse {
    return {
      id: pinnedMessage.id,
      conversationId: pinnedMessage.conversationId,
      messageId: pinnedMessage.messageId,
      pinnedBy: pinnedMessage.pinnedBy,
      createdAt: pinnedMessage.createdAt,
      message: {
        id: pinnedMessage.message.id,
        conversationId: pinnedMessage.message.conversationId,
        senderId: pinnedMessage.message.senderId,
        parentId: pinnedMessage.message.parentId ?? null,
        content: pinnedMessage.message.content,
        isEdited: pinnedMessage.message.isEdited,
        editedAt: pinnedMessage.message.editedAt,
        createdAt: pinnedMessage.message.createdAt,
        updatedAt: pinnedMessage.message.updatedAt,
        sender: pinnedMessage.message.sender,
        parent: null,
        attachments: pinnedMessage.message.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          storageKey: attachment.fileObject.storageKey,
          fileHash: attachment.fileObject.fileHash,
          fileType: attachment.fileObject.fileType,
          fileSize: attachment.fileObject.fileSize,
        })),
        replyCount: pinnedMessage.message._count.replies,
      },
    };
  }
}
