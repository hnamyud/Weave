import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('uuid', () => ({
  v7: () => 'workspace-member-id',
}));

import { WorkspaceMembersService } from './workspace_members.service';
import { WorkspaceRole } from '../../shared/enums/workspace-role.enum';
import { PrismaService } from '../../../prisma/prisma.service';

describe('WorkspaceMembersService', () => {
  const prisma = {
    workspaceMember: {
      count: jest.fn<(args: any) => Promise<number>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  let service: WorkspaceMembersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkspaceMembersService(prisma as unknown as PrismaService);
  });

  it('lists members only for non-deleted workspaces', async () => {
    prisma.workspaceMember.count.mockResolvedValue(1);
    prisma.workspaceMember.findMany.mockResolvedValue([
      {
        user: {
          id: 'user-id',
          username: 'user',
          displayName: 'User',
        },
        role: 'MEMBER',
        joinedAt: new Date('2026-05-22T00:00:00.000Z'),
      },
    ]);

    await service.getWorkspaceMembers('1', '10', 'workspace-id');

    expect(prisma.workspaceMember.count).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        workspace: {
          isDeleted: false,
        },
        leftAt: null,
      },
    });
    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: 'workspace-id',
          workspace: {
            isDeleted: false,
          },
          leftAt: null,
        },
      }),
    );
  });

  it('rejects invalid pagination values', async () => {
    await expect(
      service.getWorkspaceMembers('0', '10', 'workspace-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('grants roles only to active members in non-deleted workspaces', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'actor-id', role: 'OWNER' }) // actor
      .mockResolvedValueOnce({ id: 'member-id', role: 'MEMBER' }); // target
    prisma.workspaceMember.update.mockResolvedValue({
      id: 'member-id',
      role: 'ADMIN',
    });

    const result = await service.grantWorkspaceRole(
      'workspace-id',
      'user-id',
      'ADMIN',
      'actor-id',
    );

    expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: 'workspace-id',
          userId: 'user-id',
        },
      },
      data: {
        role: 'ADMIN',
      },
    });
    expect(result).toEqual({
      id: 'member-id',
      role: 'ADMIN',
    });
  });

  it('rejects granting roles to missing or inactive members', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'actor-id', role: 'OWNER' }) // actor
      .mockResolvedValueOnce(null); // target not found

    await expect(
      service.grantWorkspaceRole(
        'workspace-id',
        'user-id',
        WorkspaceRole.Admin,
        'actor-id',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('rejects invalid workspace roles', async () => {
    await expect(
      service.grantWorkspaceRole(
        'workspace-id',
        'user-id',
        'INVALID' as WorkspaceRole,
        'actor-id',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('rejects granting workspace owner role', async () => {
    await expect(
      service.grantWorkspaceRole(
        'workspace-id',
        'user-id',
        WorkspaceRole.Owner,
        'actor-id',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('rejects changing the current workspace owner role', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'actor-id', role: 'OWNER' }) // actor
      .mockResolvedValueOnce({ id: 'owner-id', role: 'OWNER' }); // target is OWNER

    await expect(
      service.grantWorkspaceRole(
        'workspace-id',
        'owner-id',
        WorkspaceRole.Admin,
        'actor-id',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('rejects ADMIN trying to grant ADMIN role to another member', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'actor-id', role: 'ADMIN' }) // actor is ADMIN
      .mockResolvedValueOnce({ id: 'member-id', role: 'MEMBER' }); // target is MEMBER

    await expect(
      service.grantWorkspaceRole(
        'workspace-id',
        'member-id',
        WorkspaceRole.Admin,
        'actor-id',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('rejects ADMIN trying to demote another ADMIN', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'actor-id', role: 'ADMIN' }) // actor is ADMIN
      .mockResolvedValueOnce({ id: 'other-admin-id', role: 'ADMIN' }); // target is ADMIN

    await expect(
      service.grantWorkspaceRole(
        'workspace-id',
        'other-admin-id',
        WorkspaceRole.Member,
        'actor-id',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('allows OWNER to demote an ADMIN to MEMBER', async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ id: 'actor-id', role: 'OWNER' }) // actor is OWNER
      .mockResolvedValueOnce({ id: 'admin-id', role: 'ADMIN' }); // target is ADMIN
    prisma.workspaceMember.update.mockResolvedValue({
      id: 'admin-id',
      role: 'MEMBER',
    });

    await expect(
      service.grantWorkspaceRole(
        'workspace-id',
        'admin-id',
        WorkspaceRole.Member,
        'actor-id',
      ),
    ).resolves.toEqual({ id: 'admin-id', role: 'MEMBER' });
  });

  it('prevents the owner from leaving their workspace', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: 'OWNER',
    });

    await expect(
      service.kickMember('workspace-id', 'owner-id'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });
});
