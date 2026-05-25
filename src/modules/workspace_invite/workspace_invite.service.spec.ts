import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

jest.mock('uuid', () => ({
  v7: () => 'invite-id',
}));

import { WorkspaceInviteService } from './workspace_invite.service';

describe('WorkspaceInviteService', () => {
  const prisma = {
    $transaction: jest.fn<(callback: (tx: any) => Promise<any>) => Promise<any>>(),
    workspaceMember: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
    },
    workspaceInvite: {
      count: jest.fn<(args: any) => Promise<number>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
    },
    workspaceInviteResponse: {
      create: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  const configService = {
    get: jest.fn<(key: string) => string | undefined>(),
  };

  let service: WorkspaceInviteService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    configService.get.mockImplementation((key) => {
      const values: Record<string, string> = {
        INVITE_EXPIRES_IN_DAYS: '7',
        URL_INVITE: 'https://app.test/invite/',
      };
      return values[key];
    });
    service = new WorkspaceInviteService(prisma as any, configService as any);
  });

  it('creates invite links with a stored raw token and returns the invite URL', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.workspaceInvite.create.mockResolvedValue({ id: 'invite-id' });

    const inviteUrl = await service.createInviteLink({
      workspaceId: 'workspace-id',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    }, 'creator-id');

    const rawToken = inviteUrl.replace('https://app.test/invite/', '');

    expect(rawToken).toHaveLength(22);
    expect(prisma.workspaceInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rawToken,
      }),
    });
    expect(prisma.workspaceInvite.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
        tokenHash: expect.any(String),
        token: expect.any(String),
      }),
    });
  });

  it('rejects invite links when the creator is not a workspace member', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(service.createInviteLink({
      workspaceId: 'workspace-id',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    }, 'creator-id')).rejects.toThrow(BadRequestException);
  });

  it('rejects direct invite creation when invite expiry config is invalid', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    configService.get.mockReturnValue(undefined);

    await expect(service.createDirectInvite({
      workspaceId: 'workspace-id',
      invitedEmail: 'invited@example.com',
    }, 'creator-id')).rejects.toThrow(BadRequestException);
  });

  it('rejects direct invites for emails that already belong to workspace members', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'creator-member-id' })
      .mockResolvedValueOnce({ id: 'invited-member-id' });

    await expect(service.createDirectInvite({
      workspaceId: 'workspace-id',
      invitedEmail: 'invited@example.com',
    }, 'creator-id')).rejects.toThrow(BadRequestException);

    expect(prisma.workspaceInvite.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate active pending direct invites for the same workspace and invited email', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'creator-member-id' })
      .mockResolvedValueOnce(null);
    prisma.workspaceInvite.findFirst.mockResolvedValue({ id: 'existing-invite-id' });

    await expect(service.createDirectInvite({
      workspaceId: 'workspace-id',
      invitedEmail: 'invited@example.com',
    }, 'creator-id')).rejects.toThrow(BadRequestException);

    expect(prisma.workspaceInvite.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: 'workspace-id',
        invitedEmail: 'invited@example.com',
        type: 'DIRECT',
        revokedAt: null,
      }),
    });
    expect(prisma.workspaceInvite.create).not.toHaveBeenCalled();
  });

  it('maps direct invite Prisma create errors to BadRequestException', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'creator-member-id' })
      .mockResolvedValueOnce(null);
    prisma.workspaceInvite.findFirst.mockResolvedValue(null);
    prisma.workspaceInvite.create.mockRejectedValue({ code: 'P2003' });

    await expect(service.createDirectInvite({
      workspaceId: 'workspace-id',
      invitedEmail: 'invited@example.com',
    }, 'creator-id')).rejects.toThrow(BadRequestException);
  });

  it('creates direct invites with invited email, raw token, and returns an invite URL', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'creator-member-id' })
      .mockResolvedValueOnce(null);
    prisma.workspaceInvite.findFirst.mockResolvedValue(null);
    prisma.workspaceInvite.create.mockResolvedValue({ id: 'direct-invite-id' });

    const inviteUrl = await service.createDirectInvite({
      workspaceId: 'workspace-id',
      invitedEmail: 'Invited@Example.COM',
    }, 'creator-id');
    const rawToken = inviteUrl.replace('https://app.test/invite/', '');

    expect(rawToken).toHaveLength(22);
    expect(prisma.workspaceInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-id',
        type: 'DIRECT',
        invitedEmail: 'invited@example.com',
        rawToken,
      }),
    });
  });

  it('maps link invite Prisma create errors to BadRequestException', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'creator-member-id' });
    prisma.workspaceInvite.create.mockRejectedValue({ code: 'P2003' });

    await expect(service.createInviteLink({
      workspaceId: 'workspace-id',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    }, 'creator-id')).rejects.toThrow(BadRequestException);
  });

  it('accepts direct invites atomically using the invite workspace id', async () => {
    prisma.workspaceInvite.findFirst.mockResolvedValue({
      id: 'direct-invite-id',
      workspaceId: 'workspace-id',
      type: 'DIRECT',
      rawToken: 'direct-token',
      invitedEmail: 'current@example.com',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: null,
    });
    prisma.workspaceInviteResponse.create.mockResolvedValue({ id: 'response-id' });
    prisma.workspaceMember.create.mockResolvedValue({ id: 'member-id' });

    await service.acceptDirectInvite({
      token: 'direct-token',
    }, {
      id: 'current-user-id',
      email: 'current@example.com',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.workspaceInviteResponse.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inviteId: 'direct-invite-id',
        userId: 'current-user-id',
        status: 'ACCEPTED',
      }),
    });
    expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-id',
        userId: 'current-user-id',
      }),
    });
  });

  it('rejects revoked direct invites', async () => {
    prisma.workspaceInvite.findFirst.mockResolvedValue({
      id: 'direct-invite-id',
      workspaceId: 'workspace-id',
      type: 'DIRECT',
      rawToken: 'direct-token',
      invitedEmail: 'current@example.com',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    await expect(service.acceptDirectInvite({
      token: 'direct-token',
    }, {
      id: 'current-user-id',
      email: 'current@example.com',
    }))
      .rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects link deny attempts', async () => {
    prisma.workspaceInvite.findFirst.mockResolvedValue({
      id: 'link-invite-id',
      workspaceId: 'workspace-id',
      type: 'LINK',
      invitedEmail: null,
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: null,
    });

    await expect(service.denyInvite({
      token: 'link-token',
    }, {
      id: 'current-user-id',
      email: 'current@example.com',
    }))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceInviteResponse.create).not.toHaveBeenCalled();
  });

  it('accepts link invites by raw token in a transaction', async () => {
    const token = 'raw-link-token';
    prisma.workspaceInvite.findFirst.mockResolvedValue({
      id: 'link-invite-id',
      workspaceId: 'workspace-id',
      type: 'LINK',
      rawToken: token,
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: null,
    });
    prisma.workspaceInviteResponse.create.mockResolvedValue({ id: 'response-id' });
    prisma.workspaceMember.create.mockResolvedValue({ id: 'member-id' });

    await service.acceptLinkInvite({
      token,
    }, 'current-user-id');

    expect(prisma.workspaceInvite.findFirst).toHaveBeenCalledWith({
      where: {
        type: 'LINK',
        rawToken: token,
        revokedAt: null,
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-id',
        userId: 'current-user-id',
      }),
    });
  });

  it('revokes an active invite when the requester belongs to the workspace', async () => {
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: 'invite-id-to-revoke',
      workspaceId: 'workspace-id',
      revokedAt: null,
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.workspaceInvite.update.mockResolvedValue({
      id: 'invite-id-to-revoke',
      revokedAt: new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.revokeInvite('invite-id-to-revoke', 'requester-id');

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        userId: 'requester-id',
      },
    });
    expect(prisma.workspaceInvite.update).toHaveBeenCalledWith({
      where: {
        id: 'invite-id-to-revoke',
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({
      id: 'invite-id-to-revoke',
      revokedAt: expect.any(Date),
    });
  });

  it('rejects revoke when invite does not exist', async () => {
    prisma.workspaceInvite.findUnique.mockResolvedValue(null);

    await expect(service.revokeInvite('missing-invite-id', 'requester-id'))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceInvite.update).not.toHaveBeenCalled();
  });

  it('rejects revoke when requester is not a workspace member', async () => {
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: 'invite-id-to-revoke',
      workspaceId: 'workspace-id',
      revokedAt: null,
    });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(service.revokeInvite('invite-id-to-revoke', 'requester-id'))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceInvite.update).not.toHaveBeenCalled();
  });

  it('rejects revoke when invite is already revoked', async () => {
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: 'invite-id-to-revoke',
      workspaceId: 'workspace-id',
      revokedAt: new Date('2026-05-20T00:00:00.000Z'),
    });

    await expect(service.revokeInvite('invite-id-to-revoke', 'requester-id'))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceInvite.update).not.toHaveBeenCalled();
  });

  it('returns the existing active link invite instead of creating a new one', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.workspaceInvite.findFirst.mockResolvedValue({
      id: 'existing-link-id',
      type: 'LINK',
      rawToken: 'existing-raw-token',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: null,
    });

    const inviteUrl = await service.createInviteLink({
      workspaceId: 'workspace-id',
      expiresAt: new Date('2026-06-10T00:00:00.000Z'),
    }, 'creator-id');

    expect(prisma.workspaceInvite.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        type: 'LINK',
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      select: {
        id: true,
        rawToken: true,
      },
    });
    expect(prisma.workspaceInvite.create).not.toHaveBeenCalled();
    expect(inviteUrl).toBe('https://app.test/invite/existing-raw-token');
  });

  it('revokes an existing active link that cannot be copied before creating a new link invite', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.workspaceInvite.findFirst.mockResolvedValue({
      id: 'legacy-link-id',
      type: 'LINK',
      rawToken: null,
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: null,
    });
    prisma.workspaceInvite.create.mockResolvedValue({ id: 'new-link-id' });

    await service.createInviteLink({
      workspaceId: 'workspace-id',
      expiresAt: new Date('2026-06-10T00:00:00.000Z'),
    }, 'creator-id');

    expect(prisma.workspaceInvite.update).toHaveBeenCalledWith({
      where: {
        id: 'legacy-link-id',
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(prisma.workspaceInvite.create).toHaveBeenCalled();
  });


  it('lists active direct workspace invites with pagination', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.workspaceInvite.count.mockResolvedValue(1);
    prisma.workspaceInvite.findMany.mockResolvedValue([
      {
        id: 'invite-id',
        type: 'DIRECT',
        invitedEmail: 'invited@example.com',
        role: 'MEMBER',
        expiresAt: new Date('2026-06-01T00:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-05-25T00:00:00.000Z'),
      },
    ]);

    const result = await service.getWorkspaceInvites({
      currentPage: 1,
      limit: 10,
      workspaceId: 'workspace-id',
      requesterId: 'requester-id',
      type: 'DIRECT',
      status: 'ACTIVE',
    });

    const expectedWhere = {
      workspaceId: 'workspace-id',
      workspace: {
        isDeleted: false,
      },
      type: 'DIRECT',
      revokedAt: null,
      expiresAt: {
        gt: expect.any(Date),
      },
    };

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        userId: 'requester-id',
      },
    });
    expect(prisma.workspaceInvite.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
    expect(prisma.workspaceInvite.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expectedWhere,
      skip: 0,
      take: 10,
      orderBy: { createdAt: 'desc' },
    }));
    expect(result).toEqual({
      meta: {
        current: 1,
        pageSize: 10,
        pages: 1,
        total: 1,
      },
      result: [
        {
          id: 'invite-id',
          type: 'DIRECT',
          invitedEmail: 'invited@example.com',
          role: 'MEMBER',
          expiresAt: new Date('2026-06-01T00:00:00.000Z'),
          revokedAt: null,
          createdAt: new Date('2026-05-25T00:00:00.000Z'),
        },
      ],
    });
  });

  it('adds accepted usage count for link invites in list results', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.workspaceInvite.count.mockResolvedValue(1);
    prisma.workspaceInvite.findMany.mockResolvedValue([
      {
        id: 'link-invite-id',
        type: 'LINK',
        rawToken: 'raw-link-token',
        invitedEmail: null,
        role: 'MEMBER',
        expiresAt: new Date('2026-06-01T00:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-05-25T00:00:00.000Z'),
        _count: {
          responses: 3,
        },
      },
    ]);

    const result = await service.getWorkspaceInvites({
      currentPage: 1,
      limit: 10,
      workspaceId: 'workspace-id',
      requesterId: 'requester-id',
      type: 'LINK',
      status: 'ACTIVE',
    });

    expect(prisma.workspaceInvite.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        _count: {
          select: {
            responses: {
              where: {
                status: 'ACCEPTED',
              },
            },
          },
        },
        rawToken: true,
      }),
    }));
    expect(result.result).toEqual([
      {
        id: 'link-invite-id',
        type: 'LINK',
        invitedEmail: null,
        role: 'MEMBER',
        expiresAt: new Date('2026-06-01T00:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-05-25T00:00:00.000Z'),
        inviteUrl: 'https://app.test/invite/raw-link-token',
        usageCount: 3,
      },
    ]);
  });

  it('rejects invalid invite list filters', async () => {
    await expect(service.getWorkspaceInvites({
      currentPage: 1,
      limit: 10,
      workspaceId: 'workspace-id',
      requesterId: 'requester-id',
      type: 'INVALID',
      status: 'ACTIVE',
    })).rejects.toThrow(BadRequestException);

    expect(prisma.workspaceInvite.findMany).not.toHaveBeenCalled();
  });
});
