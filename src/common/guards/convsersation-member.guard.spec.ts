import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

import { ConversationMemberGuard } from './conversation-member.guard';

function objectContaining<T extends object>(value: T): T {
  const matcher: unknown = expect.objectContaining(value);
  return matcher as T;
}

describe('ConversationMemberGuard', () => {
  const prisma = {
    conversationMember: {
      findFirst: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
  };

  const createContext = (request: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: <TRequest>() => request as TRequest,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches active conversation member context from conversationId', async () => {
    const guard = new ConversationMemberGuard(
      prisma as unknown as PrismaService,
    );
    const request: {
      user: { id: string };
      params: { conversationId: string };
      conversationMember?: unknown;
      conversation?: unknown;
      workspaceId?: string;
    } = {
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
    const guard = new ConversationMemberGuard(
      prisma as unknown as PrismaService,
    );
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

    expect(prisma.conversationMember.findFirst).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          conversationId: 'conversation-id',
        }),
      }),
    );
  });

  it('rejects when user is not an active conversation member', async () => {
    const guard = new ConversationMemberGuard(
      prisma as unknown as PrismaService,
    );
    const request = {
      user: { id: 'user-id' },
      params: { conversationId: 'conversation-id' },
    };
    prisma.conversationMember.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
