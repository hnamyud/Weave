import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

jest.mock('uuid', () => ({
  v7: jest.fn()
    .mockReturnValueOnce('conversation-id')
    .mockReturnValueOnce('conversation-member-id'),
}));

jest.mock('src/shared/enums/conversation-role.enum', () => ({
  ConversationRole: {
    Admin: 'ADMIN',
    Member: 'MEMBER',
  },
}), { virtual: true });

jest.mock('src/shared/enums/conversation-type.enum', () => ({
  ConversationType: {
    Channel: 'CHANNEL',
    Dm: 'DM',
    GroupDm: 'GROUP_DM',
  },
}), { virtual: true });

import { ConversationService } from './conversation.service';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { ConversationRole } from '../../shared/enums/conversation-role.enum';

describe('ConversationService', () => {
  const prisma = {
    workspaceMember: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    conversation: {
      create: jest.fn<(args: any) => Promise<any>>(),
    },
    conversationMember: {
      create: jest.fn<(args: any) => Promise<any>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
    },
    $transaction: jest.fn<(callback: (tx: any) => Promise<any>) => Promise<any>>(),
  };

  let service: ConversationService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    service = new ConversationService(prisma as any);
  });

  it('creates a conversation and adds the creator as an admin member when the creator is an active workspace member', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'workspace-member-id' });
    prisma.conversation.create.mockResolvedValue({
      id: 'conversation-id',
      workspaceId: 'workspace-id',
      type: ConversationType.Channel,
      name: 'general',
      createdBy: 'user-id',
    });
    prisma.conversationMember.create.mockResolvedValue({});

    const result = await service.createConversation({
      workspaceId: 'workspace-id',
      type: ConversationType.Channel,
      name: 'general',
      description: 'Team updates',
      isPrivate: false,
      isArchived: false,
    }, 'user-id');

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        userId: 'user-id',
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
    });
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
        type: ConversationType.Channel,
        name: 'general',
        description: 'Team updates',
        isPrivate: false,
        isArchived: false,
        createdBy: 'user-id',
      },
    });
    expect(prisma.conversationMember.create).toHaveBeenCalledWith({
      data: {
        id: 'conversation-member-id',
        conversationId: 'conversation-id',
        userId: 'user-id',
        role: ConversationRole.Admin,
      },
    });
    expect(result).toEqual({
      id: 'conversation-id',
      workspaceId: 'workspace-id',
      type: ConversationType.Channel,
      name: 'general',
      createdBy: 'user-id',
    });
  });

  it('rejects creating a conversation when the creator is not an active workspace member', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(service.createConversation({
      workspaceId: 'workspace-id',
      type: ConversationType.Channel,
    }, 'user-id')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

});
