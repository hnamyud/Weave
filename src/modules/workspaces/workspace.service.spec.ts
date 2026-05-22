import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

jest.mock('uuid', () => ({
  v7: () => 'workspace-id',
}));

import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  const prisma = {
    $transaction: jest.fn<(callback: (tx: any) => Promise<any>) => Promise<any>>(),
    workspace: {
      create: jest.fn<(args: any) => Promise<any>>(),
    },
    workspaceMember: {
      create: jest.fn<(args: any) => Promise<any>>(),
      count: jest.fn<(args: any) => Promise<number>>(),
      findMany: jest.fn<(args: any) => Promise<any[]>>(),
    },
  };

  let service: WorkspaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    service = new WorkspaceService(prisma as any);
  });

  it('creates workspace and owner membership in one transaction', async () => {
    prisma.workspace.create.mockResolvedValue({
      id: 'workspace-id',
      name: 'Workspace',
      slug: 'workspace',
      iconUrl: null,
      ownerId: 'owner-id',
    });
    prisma.workspaceMember.create.mockResolvedValue({ id: 'member-id' });

    const result = await service.createWorkspace({
      name: 'Workspace',
      slug: 'workspace',
    }, 'owner-id');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: {
        id: 'workspace-id',
        name: 'Workspace',
        slug: 'workspace',
        iconUrl: undefined,
        ownerId: 'owner-id',
      },
    });
    expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        id: 'workspace-id',
        workspaceId: 'workspace-id',
        userId: 'owner-id',
        role: 'OWNER',
      },
    });
    expect(result).toEqual({
      id: 'workspace-id',
      name: 'Workspace',
      slug: 'workspace',
      iconUrl: null,
      ownerId: 'owner-id',
    });
  });

  it('maps duplicate workspace create errors to ConflictException', async () => {
    prisma.workspace.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.createWorkspace({
      name: 'Workspace',
      slug: 'workspace',
    }, 'owner-id')).rejects.toThrow(ConflictException);
  });

  it('maps invalid owner create errors to BadRequestException', async () => {
    prisma.workspace.create.mockRejectedValue({ code: 'P2003' });

    await expect(service.createWorkspace({
      name: 'Workspace',
      slug: 'workspace',
    }, 'owner-id')).rejects.toThrow(BadRequestException);
  });

  it('gets active workspaces for a user with pagination metadata', async () => {
    prisma.workspaceMember.count.mockResolvedValue(1);
    prisma.workspaceMember.findMany.mockResolvedValue([
      {
        role: 'OWNER',
        joinedAt: new Date('2026-05-22T00:00:00.000Z'),
        workspace: {
          id: 'workspace-id',
          name: 'Workspace',
          slug: 'workspace',
          iconUrl: null,
          createdAt: new Date('2026-05-22T00:00:00.000Z'),
        },
      },
    ]);

    const result = await service.getAllWorkspaceById(1, 10, 'user-id');

    const where = {
      userId: 'user-id',
      leftAt: null,
      workspace: {
        isDeleted: false,
      },
    };
    expect(prisma.workspaceMember.count).toHaveBeenCalledWith({ where });
    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where,
      skip: 0,
      take: 10,
      orderBy: {
        joinedAt: 'desc',
      },
    }));
    expect(result.meta).toEqual({
      current: 1,
      pageSize: 10,
      pages: 1,
      total: 1,
    });
    expect(result.result).toHaveLength(1);
  });
});
