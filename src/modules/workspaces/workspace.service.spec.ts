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
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
    },
    workspaceMember: {
      create: jest.fn<(args: any) => Promise<any>>(),
      count: jest.fn<(args: any) => Promise<number>>(),
      findFirst: jest.fn<(args: any) => Promise<any>>(),
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

  it('gets workspace detail only when the requester is an active member', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({
      role: 'OWNER',
      joinedAt: new Date('2026-05-22T00:00:00.000Z'),
      workspace: {
        id: 'workspace-id',
        name: 'Workspace',
        slug: 'workspace',
        iconUrl: null,
        createdAt: new Date('2026-05-22T00:00:00.000Z'),
      },
    });
    prisma.workspaceMember.count.mockResolvedValue(2);

    const result = await service.getWorkspaceById('workspace-id', 'user-id');

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        workspaceId: 'workspace-id',
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
      select: expect.any(Object),
    });
    expect(result.memberCount).toBe(2);
  });

  it('rejects workspace detail when the requester is not an active member', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(service.getWorkspaceById('workspace-id', 'user-id'))
      .rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.count).not.toHaveBeenCalled();
  });

  it('updates only non-deleted workspaces owned by the requester', async () => {
    prisma.workspace.findFirst.mockResolvedValue({ ownerId: 'owner-id' });
    prisma.workspace.update.mockResolvedValue({
      id: 'workspace-id',
      name: 'New name',
      slug: 'new-slug',
      iconUrl: null,
    });

    await service.updateWorkspace({
      name: 'New name',
      slug: 'new-slug',
    }, 'workspace-id', 'owner-id');

    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'workspace-id',
        isDeleted: false,
      },
      select: {
        ownerId: true,
      },
    });
  });

  it('soft deletes only non-deleted workspaces owned by the requester', async () => {
    prisma.workspace.findFirst.mockResolvedValue({ ownerId: 'owner-id' });
    prisma.workspace.update.mockResolvedValue({
      id: 'workspace-id',
      isDeleted: true,
      deletedAt: new Date('2026-05-25T00:00:00.000Z'),
    });

    await service.deleteWorkspace('workspace-id', 'owner-id');

    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'workspace-id',
        isDeleted: false,
      },
      select: {
        ownerId: true,
      },
    });
    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: {
        id: 'workspace-id',
      },
      data: {
        isDeleted: true,
        deletedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    });
  });
});
