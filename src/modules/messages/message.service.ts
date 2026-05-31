import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationRole as PrismaConversationRole,
  Prisma,
  WorkspaceRole as PrismaWorkspaceRole,
} from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';
import { FileMetadataDto } from '../files/dto/file-metadata.dto';
import { FileService } from '../files/file.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { MessageCursorQueryDto } from './dto/message-cursor-query.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

type MessageCursor = {
  createdAt: string;
  id: string;
};

type MessageWriteInput = {
  conversationId: string;
  parentId?: string;
  content?: string;
  attachments?: FileMetadataDto[];
};

type MessageSenderResponse = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type MessageParentResponse = {
  id: string;
  senderId: string | null;
  content: string | null;
  createdAt: Date;
};

type MessageAttachmentResponse = {
  id: string;
  fileName: string;
  storageKey: string;
  fileHash: string;
  fileType: string | null;
  fileSize: number | null;
};

type MessageResponse = {
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

type MessageCursorResponse = {
  result: MessageResponse[];
  nextCursor: string | null;
};

const baseMessageInclude = {
  sender: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  attachments: {
    where: {
      isDeleted: false,
    },
    include: {
      fileObject: {
        select: {
          storageKey: true,
          fileHash: true,
          fileType: true,
          fileSize: true,
        },
      },
    },
  },
  _count: {
    select: {
      replies: {
        where: {
          isDeleted: false,
        },
      },
    },
  },
} satisfies Prisma.MessageInclude;

function buildMessageWithPermissionInclude(userId: string) {
  return {
    ...baseMessageInclude,
    parent: {
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    },
    conversation: {
      select: {
        members: {
          where: {
            userId,
            leftAt: null,
          },
          select: {
            role: true,
          },
        },
        workspace: {
          select: {
            members: {
              where: {
                userId,
                leftAt: null,
              },
              select: {
                role: true,
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.MessageInclude;
}

const conversationMembershipSelect = {
  role: true,
  conversation: {
    select: {
      id: true,
      workspaceId: true,
      isArchived: true,
    },
  },
} satisfies Prisma.ConversationMemberSelect;

function buildAttachmentPermissionSelect(userId: string) {
  return {
    id: true,
    uploaderId: true,
    message: {
      select: {
        senderId: true,
        conversation: {
          select: {
            members: {
              where: {
                userId,
                leftAt: null,
              },
              select: {
                role: true,
              },
            },
            workspace: {
              select: {
                members: {
                  where: {
                    userId,
                    leftAt: null,
                  },
                  select: {
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.AttachmentSelect;
}

type MessageRecord = Prisma.MessageGetPayload<{
  include: typeof baseMessageInclude;
}>;

type MessageWithPermissionContext = Prisma.MessageGetPayload<{
  include: ReturnType<typeof buildMessageWithPermissionInclude>;
}>;

type ConversationMembership = Prisma.ConversationMemberGetPayload<{
  select: typeof conversationMembershipSelect;
}>;

type AttachmentPermissionRecord = Prisma.AttachmentGetPayload<{
  select: ReturnType<typeof buildAttachmentPermissionSelect>;
}>;

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async createMessage(dto: CreateMessageDto, userId: string) {
    return this.createMessageInConversation(
      {
        conversationId: dto.conversationId,
        content: dto.content,
        attachments: dto.attachments,
      },
      userId,
    );
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    query: MessageCursorQueryDto,
  ): Promise<MessageCursorResponse> {
    await this.ensureConversationMemberByConversationId(conversationId, userId);

    const limit = this.getCursorPageLimit(query.limit);
    const cursor = this.decodeCursor(query.cursor);
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        parentId: null,
        isDeleted: false,
        ...(cursor ? this.buildOlderThanCursorWhere(cursor) : {}),
      },
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: baseMessageInclude,
    });

    return this.buildCursorResponse(messages, limit);
  }

  async getMessageById(
    messageId: string,
    userId: string,
  ): Promise<MessageResponse> {
    const message = await this.ensureReadableMessage(messageId, userId);
    return this.mapMessageResponse(message);
  }

  async updateMessage(
    messageId: string,
    dto: UpdateMessageDto,
    userId: string,
  ): Promise<MessageResponse> {
    const message = await this.ensureWritableMessage(messageId, userId);
    const content = dto.content.trim();

    if (!content) {
      throw new BadRequestException('Message content cannot be blank');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can edit this message');
    }

    const updatedMessage = await this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: baseMessageInclude,
    });

    const response = this.mapMessageResponse(updatedMessage);
    this.realtimeService.emitMessageUpdated(response);
    return response;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.ensureWritableMessage(messageId, userId);
    const conversationRole = message.conversation.members[0]?.role;
    const workspaceRole = message.conversation.workspace.members[0]?.role;
    const canDelete =
      message.senderId === userId ||
      conversationRole === PrismaConversationRole.ADMIN ||
      workspaceRole === PrismaWorkspaceRole.ADMIN ||
      workspaceRole === PrismaWorkspaceRole.OWNER;

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this message',
      );
    }

    const deletedMessage = await this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    this.realtimeService.emitMessageDeleted({
      id: messageId,
      conversationId: message.conversationId,
    });

    return deletedMessage;
  }

  async createReply(
    messageId: string,
    dto: CreateReplyDto,
    userId: string,
  ): Promise<MessageResponse> {
    const parentMessage = await this.ensureReadableMessage(messageId, userId);

    if (parentMessage.parentId) {
      throw new BadRequestException('Nested replies are not supported');
    }

    return this.createMessageInConversation(
      {
        conversationId: parentMessage.conversationId,
        parentId: parentMessage.id,
        content: dto.content,
        attachments: dto.attachments,
      },
      userId,
    );
  }

  async getReplies(
    messageId: string,
    userId: string,
    query: MessageCursorQueryDto,
  ): Promise<MessageCursorResponse> {
    await this.ensureReadableMessage(messageId, userId);

    const limit = this.getCursorPageLimit(query.limit);
    const cursor = this.decodeCursor(query.cursor);
    const replies = await this.prisma.message.findMany({
      where: {
        parentId: messageId,
        isDeleted: false,
        ...(cursor ? this.buildOlderThanCursorWhere(cursor) : {}),
      },
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: baseMessageInclude,
    });

    return this.buildCursorResponse(replies, limit);
  }

  async deleteAttachment(attachmentId: string, userId: string) {
    const attachment: AttachmentPermissionRecord | null =
      await this.prisma.attachment.findFirst({
        where: {
          id: attachmentId,
          isDeleted: false,
          message: {
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
              members: {
                some: {
                  userId,
                  leftAt: null,
                },
              },
            },
          },
        },
        select: buildAttachmentPermissionSelect(userId),
      });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const conversationRole = attachment.message.conversation.members[0]?.role;
    const workspaceRole =
      attachment.message.conversation.workspace.members[0]?.role;
    const canDelete =
      attachment.uploaderId === userId ||
      attachment.message.senderId === userId ||
      conversationRole === PrismaConversationRole.ADMIN ||
      workspaceRole === PrismaWorkspaceRole.ADMIN ||
      workspaceRole === PrismaWorkspaceRole.OWNER;

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this attachment',
      );
    }

    return this.prisma.attachment.update({
      where: {
        id: attachmentId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  private async createMessageInConversation(
    input: MessageWriteInput,
    userId: string,
  ): Promise<MessageResponse> {
    const membership = await this.ensureConversationMemberByConversationId(
      input.conversationId,
      userId,
    );

    if (membership.conversation.isArchived) {
      throw new BadRequestException('Conversation is archived');
    }

    const trimmedContent = input.content?.trim();
    const attachments = input.attachments ?? [];
    this.fileService.validateMessageAttachments(attachments);

    if (!trimmedContent && attachments.length === 0) {
      throw new BadRequestException(
        'Message content or attachments are required',
      );
    }

    const messageId = uuidv7();
    const createdMessage = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const fileObjects: Array<{ id: string }> = [];

        for (const attachment of attachments) {
          const expectedStorageKey = this.fileService.getExpectedStorageKey(
            attachment.fileHash,
          );

          if (attachment.storageKey !== expectedStorageKey) {
            throw new BadRequestException(
              'storageKey does not match the expected file hash key',
            );
          }

          const fileObject = await this.fileService.ensureFileObject(
            {
              metadata: attachment,
              uploaderId: userId,
            },
            tx,
          );
          fileObjects.push(fileObject);
        }

        await tx.message.create({
          data: {
            id: messageId,
            conversationId: input.conversationId,
            senderId: userId,
            parentId: input.parentId,
            content: trimmedContent ?? null,
          },
          include: baseMessageInclude,
        });

        if (attachments.length > 0) {
          await tx.attachment.createMany({
            data: attachments.map((attachment, index) => ({
              id: uuidv7(),
              messageId,
              fileObjectId: fileObjects[index].id,
              uploaderId: userId,
              fileName: attachment.fileName,
            })),
          });
        }

        const createdMessage = await tx.message.findFirst({
          where: {
            id: messageId,
            isDeleted: false,
          },
          include: baseMessageInclude,
        });

        if (!createdMessage) {
          throw new NotFoundException('Message not found after creation');
        }

        return this.mapMessageResponse(createdMessage);
      },
    );

    this.realtimeService.emitMessageCreated(createdMessage);
    return createdMessage;
  }

  private async ensureConversationMemberByConversationId(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMembership> {
    const membership = await this.prisma.conversationMember.findFirst({
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
      select: conversationMembershipSelect,
    });

    if (!membership) {
      throw new ForbiddenException(
        'User is not an active member of this conversation',
      );
    }

    return membership;
  }

  private async ensureReadableMessage(
    messageId: string,
    userId: string,
  ): Promise<MessageWithPermissionContext> {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        isDeleted: false,
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
          members: {
            some: {
              userId,
              leftAt: null,
            },
          },
        },
      },
      include: buildMessageWithPermissionInclude(userId),
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  private async ensureWritableMessage(
    messageId: string,
    userId: string,
  ): Promise<MessageWithPermissionContext> {
    return this.ensureReadableMessage(messageId, userId);
  }

  private mapMessageResponse(
    message: MessageRecord | MessageWithPermissionContext,
  ): MessageResponse {
    const parent =
      'parent' in message && message.parent
        ? {
            id: message.parent.id,
            senderId: message.parent.senderId,
            content: message.parent.content,
            createdAt: message.parent.createdAt,
          }
        : null;

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      parentId: message.parentId ?? null,
      content: message.content,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender,
      parent,
      attachments: message.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        storageKey: attachment.fileObject.storageKey,
        fileHash: attachment.fileObject.fileHash,
        fileType: attachment.fileObject.fileType,
        fileSize: attachment.fileObject.fileSize,
      })),
      replyCount: message._count.replies,
    };
  }

  private getCursorPageLimit(limit?: number) {
    const pageSize = parsePositiveInteger(limit, 30, 'limit');

    if (pageSize > 100) {
      throw new BadRequestException('limit must not be greater than 100');
    }

    return pageSize;
  }

  private encodeCursor(message: { createdAt: Date; id: string }) {
    return Buffer.from(
      JSON.stringify({
        createdAt: message.createdAt.toISOString(),
        id: message.id,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor?: string): MessageCursor | null {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as MessageCursor;

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
    cursor: MessageCursor,
  ): Prisma.MessageWhereInput {
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
    messages: MessageRecord[],
    limit: number,
  ): MessageCursorResponse {
    const result = messages.map((message) => this.mapMessageResponse(message));
    const nextCursor =
      messages.length === limit
        ? this.encodeCursor(messages[messages.length - 1])
        : null;

    return {
      result,
      nextCursor,
    };
  }
}
