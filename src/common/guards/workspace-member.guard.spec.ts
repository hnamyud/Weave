import { ForbiddenException } from '@nestjs/common';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

import { WorkspaceMemberGuard } from './workspace-member.guard';

describe('WorkspaceMemberGuard', () => {
  const prisma = {
    workspaceMember: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
    workspaceInvite: {
      findUnique: jest.fn<(args: any) => Promise<any>>(),
    },
    conversation: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  const createContext = (request: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches active workspace member context from workspaceId route param', async () => {
    const guard = new WorkspaceMemberGuard(prisma as any);
    const request = {
      user: { id: 'user-id' },
      params: { workspaceId: 'workspace-id' },
      body: {},
    };
    const member = {
      id: 'workspace-member-id',
      workspaceId: 'workspace-id',
      userId: 'user-id',
      role: 'MEMBER',
      workspace: {
        id: 'workspace-id',
      },
    };
    prisma.workspaceMember.findFirst.mockResolvedValue(member);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        userId: 'user-id',
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
      include: {
        workspace: true,
      },
    });
    expect(request.workspaceMember).toBe(member);
    expect(request.workspace).toBe(member.workspace);
    expect(request.workspaceId).toBe('workspace-id');
  });

  it('resolves workspaceId from request body for create conversation', async () => {
    const guard = new WorkspaceMemberGuard(prisma as any);
    const request = {
      user: { id: 'user-id' },
      params: {},
      body: { workspaceId: 'workspace-id' },
    };
    prisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: 'workspace-id',
      workspace: { id: 'workspace-id' },
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-id',
        }),
      }),
    );
  });

  it('resolves workspaceId from inviteId for revoke invite routes', async () => {
    const guard = new WorkspaceMemberGuard(prisma as any);
    const request = {
      user: { id: 'user-id' },
      params: { inviteId: 'invite-id' },
      body: {},
    };
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: 'workspace-id',
      workspace: { id: 'workspace-id' },
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.workspaceInvite.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'invite-id',
      },
      select: {
        workspaceId: true,
      },
    });
    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-id',
        }),
      }),
    );
  });

  it('resolves workspaceId from conversationId for public conversation join routes', async () => {
    const guard = new WorkspaceMemberGuard(prisma as any);
    const request = {
      user: { id: 'user-id' },
      params: { conversationId: 'conversation-id' },
      body: {},
    };
    prisma.conversation.findFirst.mockResolvedValue({
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: 'workspace-id',
      workspace: { id: 'workspace-id' },
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'conversation-id',
        isDeleted: false,
      },
      select: {
        workspaceId: true,
      },
    });
    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-id',
        }),
      }),
    );
  });

  it('rejects when user is not an active workspace member', async () => {
    const guard = new WorkspaceMemberGuard(prisma as any);
    const request = {
      user: { id: 'user-id' },
      params: { workspaceId: 'workspace-id' },
      body: {},
    };
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
