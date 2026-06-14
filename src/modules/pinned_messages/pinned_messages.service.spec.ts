import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

const mockUuid = jest.fn<() => string>();

jest.mock('uuid', () => ({
  v7: mockUuid,
}));

import { PrismaService } from '../../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PinnedMessagesService } from './pinned_messages.service';

describe('PinnedMessagesService', () => {
  const prisma = {
    conversationMember: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    message: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    pinnedMessage: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
      delete: jest.fn<(args: any) => Promise<any>>(),
    },
  };
  const realtimeService = {
    emitPinnedMessageAdded: jest.fn<(payload: unknown) => void>(),
    emitPinnedMessageRemoved: jest.fn<(payload: unknown) => void>(),
  };

  let service: PinnedMessagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUuid.mockReset().mockReturnValue('pinned-message-id');
    service = new PinnedMessagesService(
      prisma as unknown as PrismaService,
      realtimeService as unknown as RealtimeService,
    );
  });

  it('pins a message for an active conversation member', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      conversation: {
        isArchived: false,
      },
    });
    prisma.pinnedMessage.findUnique.mockResolvedValue(null);
    prisma.pinnedMessage.create.mockResolvedValue({
      id: 'pinned-message-id',
      messageId: 'message-id',
      conversationId: 'conversation-id',
      pinnedBy: 'user-id',
    });

    const result = await service.pinMessage('message-id', 'user-id');

    expect(prisma.message.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'message-id',
        isDeleted: false,
        conversation: {
          isDeleted: false,
          workspace: {
            isDeleted: false,
            members: {
              some: { userId: 'user-id', leftAt: null },
            },
          },
          members: {
            some: { userId: 'user-id', leftAt: null },
          },
        },
      },
      include: {
        conversation: true,
      },
    });
    expect(prisma.pinnedMessage.create).toHaveBeenCalledWith({
      data: {
        id: 'pinned-message-id',
        messageId: 'message-id',
        conversationId: 'conversation-id',
        pinnedBy: 'user-id',
      },
    });
    expect(realtimeService.emitPinnedMessageAdded).toHaveBeenCalledWith({
      conversationId: 'conversation-id',
      messageId: 'message-id',
      pinnedBy: 'user-id',
    });
    expect(result).toMatchObject({ id: 'pinned-message-id' });
  });

  it('does not re-create or re-emit when the message is already pinned', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      conversation: {
        isArchived: false,
      },
    });
    prisma.pinnedMessage.findUnique.mockResolvedValue({
      id: 'pinned-message-id',
      messageId: 'message-id',
      conversationId: 'conversation-id',
      pinnedBy: 'other-user-id',
    });

    const result = await service.pinMessage('message-id', 'user-id');

    expect(prisma.pinnedMessage.create).not.toHaveBeenCalled();
    expect(realtimeService.emitPinnedMessageAdded).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'pinned-message-id' });
  });

  it('rejects pinning a message in an archived conversation', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      conversation: {
        isArchived: true,
      },
    });

    await expect(service.pinMessage('message-id', 'user-id')).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.pinnedMessage.create).not.toHaveBeenCalled();
  });

  it('unpins a message for an active conversation member regardless of who pinned it', async () => {
    prisma.pinnedMessage.findFirst.mockResolvedValue({
      id: 'pinned-message-id',
      conversationId: 'conversation-id',
      messageId: 'message-id',
      pinnedBy: 'other-user-id',
    });
    prisma.pinnedMessage.delete.mockResolvedValue({
      id: 'pinned-message-id',
      messageId: 'message-id',
    });

    const result = await service.unpinMessage('message-id', 'user-id');

    expect(prisma.pinnedMessage.findFirst).toHaveBeenCalledWith({
      where: {
        messageId: 'message-id',
        message: {
          isDeleted: false,
          conversation: {
            isDeleted: false,
            workspace: {
              isDeleted: false,
              members: {
                some: { userId: 'user-id', leftAt: null },
              },
            },
            members: {
              some: { userId: 'user-id', leftAt: null },
            },
          },
        },
      },
    });
    expect(prisma.pinnedMessage.delete).toHaveBeenCalledWith({
      where: { messageId: 'message-id' },
    });
    expect(realtimeService.emitPinnedMessageRemoved).toHaveBeenCalledWith({
      conversationId: 'conversation-id',
      messageId: 'message-id',
      pinnedBy: 'other-user-id',
    });
    expect(result).toMatchObject({ id: 'pinned-message-id' });
  });

  it('rejects unpinning when the pinned message is not accessible', async () => {
    prisma.pinnedMessage.findFirst.mockResolvedValue(null);

    await expect(service.unpinMessage('message-id', 'user-id')).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.pinnedMessage.delete).not.toHaveBeenCalled();
  });

  it('lists pinned messages newest-first with a next cursor', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'conversation-member-id',
    });
    prisma.pinnedMessage.findMany.mockResolvedValue([
      {
        id: 'pinned-message-2',
        conversationId: 'conversation-id',
        messageId: 'message-2',
        pinnedBy: 'user-2',
        createdAt: new Date('2026-06-09T00:02:00.000Z'),
        message: {
          id: 'message-2',
          conversationId: 'conversation-id',
          parentId: null,
          senderId: 'user-2',
          content: 'second pinned',
          isEdited: false,
          editedAt: null,
          createdAt: new Date('2026-06-09T00:01:00.000Z'),
          updatedAt: new Date('2026-06-09T00:01:00.000Z'),
          sender: {
            id: 'user-2',
            username: 'bob',
            displayName: 'Bob',
            avatarUrl: null,
          },
          attachments: [],
          _count: {
            replies: 1,
          },
        },
      },
      {
        id: 'pinned-message-1',
        conversationId: 'conversation-id',
        messageId: 'message-1',
        pinnedBy: 'user-1',
        createdAt: new Date('2026-06-09T00:01:00.000Z'),
        message: {
          id: 'message-1',
          conversationId: 'conversation-id',
          parentId: null,
          senderId: 'user-1',
          content: 'first pinned',
          isEdited: false,
          editedAt: null,
          createdAt: new Date('2026-06-09T00:00:00.000Z'),
          updatedAt: new Date('2026-06-09T00:00:00.000Z'),
          sender: {
            id: 'user-1',
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: null,
          },
          attachments: [],
          _count: {
            replies: 0,
          },
        },
      },
    ]);

    const result = await service.getPinnedMessages(
      'conversation-id',
      'user-id',
      {
        limit: 2,
      },
    );

    expect(prisma.conversationMember.findFirst).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-id',
        userId: 'user-id',
        leftAt: null,
        conversation: {
          isDeleted: false,
          workspace: {
            isDeleted: false,
            members: {
              some: {
                userId: 'user-id',
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
    expect(prisma.pinnedMessage.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-id',
        message: {
          isDeleted: false,
        },
      },
      take: 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        message: expect.any(Object),
      },
    });
    expect(result.result).toHaveLength(2);
    expect(result.result[0]).toMatchObject({
      id: 'pinned-message-2',
      message: {
        id: 'message-2',
        replyCount: 1,
      },
    });
    expect(typeof result.nextCursor).toBe('string');
  });

  it('rejects listing pinned messages for a non-member user', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.getPinnedMessages('conversation-id', 'user-id', {}),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.pinnedMessage.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid pinned message cursors', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'conversation-member-id',
    });

    await expect(
      service.getPinnedMessages('conversation-id', 'user-id', {
        cursor: 'not-base64-json',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.pinnedMessage.findMany).not.toHaveBeenCalled();
  });
});
