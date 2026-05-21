import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';

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
      create: jest.fn<(args: any) => Promise<any>>(),
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

  it('creates invite links with a stored hash and returns the raw token URL', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.workspaceInvite.create.mockResolvedValue({ id: 'invite-id' });

    const inviteUrl = await service.createInviteLink({
      workspaceId: 'workspace-id',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    }, 'creator-id');

    const rawToken = inviteUrl.replace('https://app.test/invite/', '');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    expect(rawToken).toHaveLength(22);
    expect(prisma.workspaceInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash,
      }),
    });
    expect(prisma.workspaceInvite.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
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
      invitedUserId: 'invited-user-id',
    }, 'creator-id')).rejects.toThrow(BadRequestException);
  });

  it('rejects direct invites for users who are already workspace members', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'creator-member-id' })
      .mockResolvedValueOnce({ id: 'invited-member-id' });

    await expect(service.createDirectInvite({
      workspaceId: 'workspace-id',
      invitedUserId: 'invited-user-id',
    }, 'creator-id')).rejects.toThrow(BadRequestException);

    expect(prisma.workspaceInvite.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate active pending direct invites for the same workspace and invited user', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'creator-member-id' })
      .mockResolvedValueOnce(null);
    prisma.workspaceInvite.findFirst.mockResolvedValue({ id: 'existing-invite-id' });

    await expect(service.createDirectInvite({
      workspaceId: 'workspace-id',
      invitedUserId: 'invited-user-id',
    }, 'creator-id')).rejects.toThrow(BadRequestException);

    expect(prisma.workspaceInvite.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: 'workspace-id',
        invitedUserId: 'invited-user-id',
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
      invitedUserId: 'invited-user-id',
    }, 'creator-id')).rejects.toThrow(BadRequestException);
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
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: 'direct-invite-id',
      workspaceId: 'workspace-id',
      type: 'DIRECT',
      invitedUserId: 'current-user-id',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: null,
    });
    prisma.workspaceInviteResponse.create.mockResolvedValue({ id: 'response-id' });
    prisma.workspaceMember.create.mockResolvedValue({ id: 'member-id' });

    await service.acceptDirectInvite({
      inviteId: 'direct-invite-id',
    }, 'current-user-id');

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
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: 'direct-invite-id',
      workspaceId: 'workspace-id',
      type: 'DIRECT',
      invitedUserId: 'current-user-id',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: new Date('2026-05-01T00:00:00.000Z'),
    });

    await expect(service.acceptDirectInvite({
      inviteId: 'direct-invite-id',
    }, 'current-user-id'))
      .rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects link deny attempts', async () => {
    prisma.workspaceInvite.findUnique.mockResolvedValue({
      id: 'link-invite-id',
      workspaceId: 'workspace-id',
      type: 'LINK',
      invitedUserId: null,
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      revokedAt: null,
    });

    await expect(service.denyInvite({
      inviteId: 'link-invite-id',
    }, 'current-user-id'))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceInviteResponse.create).not.toHaveBeenCalled();
  });

  it('accepts link invites by token hash in a transaction', async () => {
    const token = 'raw-link-token';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    prisma.workspaceInvite.findFirst.mockResolvedValue({
      id: 'link-invite-id',
      workspaceId: 'workspace-id',
      type: 'LINK',
      tokenHash,
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
        tokenHash,
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
});
