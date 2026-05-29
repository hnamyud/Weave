import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkspaceRole } from '@prisma/client';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';

@Injectable()
export class WorkspaceMembersService {
  constructor(private prisma: PrismaService) {}

  async getWorkspaceMembers(
    currentPage: number,
    limit: number,
    workspaceId: string,
  ) {
    const page = parsePositiveInteger(currentPage, 1, 'currentPage');
    const pageSize = parsePositiveInteger(limit, 10, 'limit');
    const offset = (page - 1) * pageSize;

    const where = {
      workspaceId: workspaceId,
      workspace: {
        isDeleted: false,
      },
      leftAt: null,
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
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        role: true,
        joinedAt: true,
      },
    });

    return {
      meta: {
        current: page, // trang hiện tại
        pageSize: pageSize, // số lượng bản ghi đã lấy
        pages: totalPages, // tổng số trang
        total: totalItems, // tổng số phần tử
      },
      result,
    };
  }

  async grantWorkspaceRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ) {
    this.ensureValidWorkspaceRole(role);

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
    });

    if (!member) {
      throw new BadRequestException(
        'User is not an active member of this workspace',
      );
    }

    if (member.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Workspace owner role cannot be changed');
    }

    return this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: {
        role,
      },
    });
  }

  async kickMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
    });

    if (!member) {
      throw new BadRequestException(
        'User is not an active member of this workspace',
      );
    }

    if (member.role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Workspace owner cannot leave the workspace',
      );
    }

    return this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: {
        leftAt: new Date(),
      },
    });
  }

  async leaveWorkspace(workspaceId: string, userId: string) {
    return this.kickMember(workspaceId, userId);
  }

  private ensureValidWorkspaceRole(role: WorkspaceRole) {
    if (!Object.values(WorkspaceRole).includes(role)) {
      throw new BadRequestException('Invalid workspace role');
    }

    if (role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Workspace ownership must be transferred explicitly',
      );
    }
  }
}
