import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceRole } from '@prisma/client';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async createWorkspace(dto: CreateWorkspaceDto, ownerId: string) {
    const workspaceId = uuidv7();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            id: workspaceId,
            name: dto.name,
            slug: dto.slug,
            iconUrl: dto.iconUrl,
            ownerId: ownerId,
          },
        });

        await tx.workspaceMember.create({
          data: {
            id: uuidv7(),
            workspaceId,
            userId: ownerId,
            role: WorkspaceRole.OWNER,
          },
        });

        return workspace;
      });
    } catch (error) {
      this.handleWorkspaceMutationError(error);
    }
  }

  async getAllWorkspaceById(
    currentPage: string | undefined,
    limit: string | undefined,
    userId: string,
  ) {
    const page = parsePositiveInteger(currentPage, 1, 'currentPage');
    const pageSize = parsePositiveInteger(limit, 10, 'limit');
    const offset = (page - 1) * pageSize;

    const where = {
      userId,
      leftAt: null,
      workspace: {
        isDeleted: false,
      },
    };

    const totalItems = await this.prisma.workspaceMember.count({
      where,
    });
    const totalPages = Math.ceil(totalItems / pageSize);
    const result = await this.prisma.workspaceMember.findMany({
      where,
      skip: offset,
      take: pageSize,
      orderBy: { joinedAt: 'desc' },
      select: {
        role: true,
        joinedAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      meta: {
        current: page,
        pageSize,
        pages: totalPages,
        total: totalItems,
      },
      result,
    };
  }

  async getWorkspaceById(workspaceId: string, userId: string) {
    const workspaceMember = await this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
      select: {
        role: true,
        joinedAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            createdAt: true,
          },
        },
      },
    });

    if (!workspaceMember) {
      throw new ForbiddenException(
        'User is not an active member of this workspace',
      );
    }

    const memberCount = await this.prisma.workspaceMember.count({
      where: {
        workspaceId,
        leftAt: null,
      },
    });

    return {
      ...workspaceMember,
      memberCount,
    };
  }

  async updateWorkspace(
    dto: UpdateWorkspaceDto,
    workspaceId: string,
    userId: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
      select: {
        role: true,
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'User is not an active member of this workspace',
      );
    }

    if (
      member.role !== WorkspaceRole.OWNER &&
      member.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only workspace owner or admin can update workspace',
      );
    }

    try {
      return await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          name: dto.name,
          slug: dto.slug,
          iconUrl: dto.iconUrl,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.handleWorkspaceMutationError(error);
    }
  }

  async deleteWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        isDeleted: false,
      },
      select: {
        ownerId: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace does not exist');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only workspace owner can delete workspace');
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Helper methods to handle Prisma errors and convert them to appropriate HTTP exceptions

  private handleWorkspaceMutationError(error: unknown): never {
    if (this.isPrismaError(error, 'P2002')) {
      throw new ConflictException('Workspace slug already exists');
    }

    if (this.isPrismaError(error, 'P2003')) {
      throw new BadRequestException('Workspace owner does not exist');
    }

    throw error;
  }

  private isPrismaError(error: unknown, code: string) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }
}
