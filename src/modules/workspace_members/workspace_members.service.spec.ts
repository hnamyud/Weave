import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

jest.mock('uuid', () => ({
  v7: () => 'workspace-member-id',
}));

import { WorkspaceMembersService } from './workspace_members.service';

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
    service = new WorkspaceMembersService(prisma as any);
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

    await service.getWorkspaceMembers(1, 10, 'workspace-id');

    expect(prisma.workspaceMember.count).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-id',
        workspace: {
          isDeleted: false,
        },
        leftAt: null,
      },
    });
    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workspaceId: 'workspace-id',
        workspace: {
          isDeleted: false,
        },
        leftAt: null,
      },
    }));
  });

  it('rejects invalid pagination values', async () => {
    await expect(service.getWorkspaceMembers(0, 10, 'workspace-id'))
      .rejects.toThrow(BadRequestException);
  });

  it('grants roles only to active members in non-deleted workspaces', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    prisma.workspaceMember.update.mockResolvedValue({
      id: 'member-id',
      role: 'ADMIN',
    });

    const result = await service.grantWorkspaceRole('workspace-id', 'user-id', 'ADMIN' as any);

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
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(service.grantWorkspaceRole('workspace-id', 'user-id', 'ADMIN' as any))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('rejects invalid workspace roles', async () => {
    await expect(service.grantWorkspaceRole('workspace-id', 'user-id', 'INVALID' as any))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('rejects granting workspace owner role', async () => {
    await expect(service.grantWorkspaceRole('workspace-id', 'user-id', 'OWNER' as any))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('rejects changing the current workspace owner role', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: 'OWNER',
    });

    await expect(service.grantWorkspaceRole('workspace-id', 'owner-id', 'ADMIN' as any))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it('prevents the owner from leaving their workspace', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: 'member-id',
      role: 'OWNER',
    });

    await expect(service.kickMember('workspace-id', 'owner-id'))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });
});
