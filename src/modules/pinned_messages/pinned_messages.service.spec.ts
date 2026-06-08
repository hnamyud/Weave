import { BadRequestException, NotFoundException } from '@nestjs/common';
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
import { PinnedMessagesService } from './pinned_messages.service';

describe('PinnedMessagesService', () => {
  const prisma = {
    message: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    pinnedMessage: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      upsert: jest.fn<(args: any) => Promise<any>>(),
      delete: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  let service: PinnedMessagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUuid.mockReset().mockReturnValue('pinned-message-id');
    service = new PinnedMessagesService(prisma as unknown as PrismaService);
  });

  it('pins a message for an active conversation member', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-id',
      conversationId: 'conversation-id',
      conversation: {
        isArchived: false,
      },
    });
    prisma.pinnedMessage.upsert.mockResolvedValue({
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
    expect(prisma.pinnedMessage.upsert).toHaveBeenCalledWith({
      where: { messageId: 'message-id' },
      update: {},
      create: {
        id: 'pinned-message-id',
        messageId: 'message-id',
        conversationId: 'conversation-id',
        pinnedBy: 'user-id',
      },
    });
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

    expect(prisma.pinnedMessage.upsert).not.toHaveBeenCalled();
  });

  it('unpins a message for an active conversation member regardless of who pinned it', async () => {
    prisma.pinnedMessage.findFirst.mockResolvedValue({
      id: 'pinned-message-id',
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
    expect(result).toMatchObject({ id: 'pinned-message-id' });
  });

  it('rejects unpinning when the pinned message is not accessible', async () => {
    prisma.pinnedMessage.findFirst.mockResolvedValue(null);

    await expect(service.unpinMessage('message-id', 'user-id')).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.pinnedMessage.delete).not.toHaveBeenCalled();
  });
});
