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
      },
    });
    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workspaceId: 'workspace-id',
        workspace: {
          isDeleted: false,
        },
      },
    }));
  });

  it('rejects invalid pagination values', async () => {
    await expect(service.getWorkspaceMembers(0, 10, 'workspace-id'))
      .rejects.toThrow(BadRequestException);
  });
});
