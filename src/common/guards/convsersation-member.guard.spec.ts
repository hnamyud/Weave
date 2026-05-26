import { ForbiddenException } from '@nestjs/common';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

import { ConversationMemberGuard } from './conversation-member.guard';

describe('ConversationMemberGuard', () => {
  const prisma = {
    conversationMember: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  const createContext = (request: any) => ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches active conversation member context from conversationId', async () => {
    const guard = new ConversationMemberGuard(prisma as any);
    const request = {
      user: { id: 'user-id' },
      params: { conversationId: 'conversation-id' },
    };
    const member = {
      id: 'conversation-member-id',
      conversationId: 'conversation-id',
      userId: 'user-id',
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
      },
    };
    prisma.conversationMember.findFirst.mockResolvedValue(member);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

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
      include: {
        conversation: true,
      },
    });
    expect(request.conversationMember).toBe(member);
    expect(request.conversation).toBe(member.conversation);
    expect(request.workspaceId).toBe('workspace-id');
  });

  it('supports conversation id from generic id route param', async () => {
    const guard = new ConversationMemberGuard(prisma as any);
    const request = {
      user: { id: 'user-id' },
      params: { id: 'conversation-id' },
    };
    prisma.conversationMember.findFirst.mockResolvedValue({
      conversation: {
        workspaceId: 'workspace-id',
      },
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.conversationMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conversationId: 'conversation-id',
      }),
    }));
  });

  it('rejects when user is not an active conversation member', async () => {
    const guard = new ConversationMemberGuard(prisma as any);
    const request = {
      user: { id: 'user-id' },
      params: { conversationId: 'conversation-id' },
    };
    prisma.conversationMember.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(ForbiddenException);
  });
});
