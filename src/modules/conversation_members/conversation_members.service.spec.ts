import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('uuid', () => ({
  v7: () => 'conversation-member-id',
}));

jest.mock(
  'src/shared/enums/conversation-role.enum',
  () => ({
    ConversationRole: {
      Admin: 'ADMIN',
      Member: 'MEMBER',
      Guest: 'GUEST',
    },
  }),
  { virtual: true },
);

import { ConversationMembersService } from './conversation_members.service';

describe('ConversationMembersService', () => {
  const prisma = {
    conversationMember: {
      count: jest.fn<(args: any) => Promise<number>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  let service: ConversationMembersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationMembersService(prisma as any);
  });

  it('lists conversation members with pagination when requester belongs to the conversation', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'requester-member-id',
    });
    prisma.conversationMember.count.mockResolvedValue(1);
    prisma.conversationMember.findMany.mockResolvedValue([
      {
        role: 'ADMIN',
        joinedAt: new Date('2026-05-23T00:00:00.000Z'),
        lastReadAt: null,
        isMuted: false,
        user: {
          id: 'user-id',
          username: 'user',
          displayName: 'User',
          avatarUrl: null,
        },
      },
    ]);

    const result = await service.getConversationMembers(
      1,
      10,
      'conversation-id',
      'requester-id',
    );

    const where = {
      conversationId: 'conversation-id',
      leftAt: null,
    };
    expect(prisma.conversationMember.findFirst).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-id',
        userId: 'requester-id',
        leftAt: null,
      },
    });
    expect(prisma.conversationMember.count).toHaveBeenCalledWith({ where });
    expect(prisma.conversationMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 0,
        take: 10,
        orderBy: { joinedAt: 'asc' },
      }),
    );
    expect(result).toEqual({
      meta: {
        current: 1,
        pageSize: 10,
        pages: 1,
        total: 1,
      },
      result: [
        {
          role: 'ADMIN',
          joinedAt: new Date('2026-05-23T00:00:00.000Z'),
          lastReadAt: null,
          isMuted: false,
          user: {
            id: 'user-id',
            username: 'user',
            displayName: 'User',
            avatarUrl: null,
          },
        },
      ],
    });
  });

  it('rejects invalid pagination values', async () => {
    await expect(
      service.getConversationMembers(0, 10, 'conversation-id', 'requester-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects listing members when requester is not in the conversation', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.getConversationMembers(1, 10, 'conversation-id', 'requester-id'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.conversationMember.count).not.toHaveBeenCalled();
    expect(prisma.conversationMember.findMany).not.toHaveBeenCalled();
  });
});
