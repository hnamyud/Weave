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
  v7: jest
    .fn()
    .mockReturnValueOnce('conversation-id')
    .mockReturnValueOnce('conversation-member-id'),
}));

jest.mock(
  'src/shared/enums/conversation-role.enum',
  () => ({
    ConversationRole: {
      Admin: 'ADMIN',
      Member: 'MEMBER',
    },
  }),
  { virtual: true },
);

jest.mock(
  'src/shared/enums/conversation-type.enum',
  () => ({
    ConversationType: {
      Channel: 'CHANNEL',
      Dm: 'DM',
      GroupDm: 'GROUP_DM',
    },
  }),
  { virtual: true },
);

import { ConversationService } from './conversation.service';
import { ConversationMembersService } from '../conversation_members/conversation_members.service';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { ConversationRole } from '../../shared/enums/conversation-role.enum';
import { PrismaService } from '../../../prisma/prisma.service';

describe('ConversationService', () => {
  const prisma = {
    workspaceMember: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    conversation: {
      create: jest.fn<(args: any) => Promise<any>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
    },
    conversationMember: {
      create: jest.fn<(args: any) => Promise<any>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
    },
    $transaction:
      jest.fn<(callback: (tx: any) => Promise<any>) => Promise<any>>(),
  };

  let service: ConversationService;
  const conversationMembersService = {
    addConversationMember:
      jest.fn<(conversationId: string, userId: string) => Promise<any>>(),
    removeConversationMember:
      jest.fn<(conversationId: string, userId: string) => Promise<any>>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    service = new ConversationService(
      prisma as unknown as PrismaService,
      conversationMembersService as unknown as ConversationMembersService,
    );
  });

  it('creates a conversation and adds the creator as an admin member when the creator is an active workspace member', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: 'workspace-member-id',
    });
    prisma.conversation.create.mockResolvedValue({
      id: 'conversation-id',
      workspaceId: 'workspace-id',
      type: ConversationType.Channel,
      name: 'general',
      createdBy: 'user-id',
    });
    prisma.conversationMember.create.mockResolvedValue({});

    const result = await service.createConversation(
      {
        workspaceId: 'workspace-id',
        type: ConversationType.Channel,
        name: 'general',
        description: 'Team updates',
        isPrivate: false,
        isArchived: false,
      },
      'user-id',
    );

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

    await expect(
      service.createConversation(
        {
          workspaceId: 'workspace-id',
          type: ConversationType.Channel,
        },
        'user-id',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('archives a conversation after one conversation member context lookup', async () => {
    prisma.conversationMember.findFirst.mockResolvedValue({
      id: 'conversation-member-id',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
      },
    });
    prisma.conversation.update.mockResolvedValue({
      id: 'conversation-id',
      isArchived: true,
    });

    const result = await service.archiveConversation(
      'conversation-id',
      'user-id',
    );

    expect(prisma.conversationMember.findFirst).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-id',
        userId: 'user-id',
        leftAt: null,
        conversation: {
          isDeleted: false,
          isArchived: false,
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
      include: {
        conversation: true,
      },
    });
    expect(prisma.conversation.findUnique).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conversation-id' },
      data: {
        isArchived: true,
        updatedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({
      id: 'conversation-id',
      isArchived: true,
    });
  });

  it('joins only public active channel conversations', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conversation-id',
      type: ConversationType.Channel,
      isPrivate: false,
    });
    conversationMembersService.addConversationMember.mockResolvedValue({
      id: 'conversation-member-id',
    });

    await service.joinChannel('conversation-id', 'user-id');

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'conversation-id',
        isDeleted: false,
        isArchived: false,
        isPrivate: false,
        type: ConversationType.Channel,
      },
    });
    expect(
      conversationMembersService.addConversationMember,
    ).toHaveBeenCalledWith('conversation-id', 'user-id');
  });

  it('adds a member to an existing private channel', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conversation-id',
      isPrivate: true,
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: 'workspace-member-id',
    });
    conversationMembersService.addConversationMember.mockResolvedValue({
      id: 'conversation-member-id',
    });

    await service.addMemberToPrivateChannel(
      'conversation-id',
      'target-user-id',
    );

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'conversation-id',
        isDeleted: false,
        isPrivate: true,
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });
    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        userId: 'target-user-id',
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
    });
    expect(
      conversationMembersService.addConversationMember,
    ).toHaveBeenCalledWith('conversation-id', 'target-user-id');
  });

  it('removes a member from an existing private channel', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conversation-id',
      isPrivate: true,
    });
    conversationMembersService.removeConversationMember.mockResolvedValue({
      id: 'conversation-member-id',
    });

    await service.removeMemberFromPrivateChannel(
      'conversation-id',
      'target-user-id',
    );

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'conversation-id',
        isDeleted: false,
        isPrivate: true,
      },
      select: {
        id: true,
      },
    });
    expect(
      conversationMembersService.removeConversationMember,
    ).toHaveBeenCalledWith('conversation-id', 'target-user-id');
  });
});
