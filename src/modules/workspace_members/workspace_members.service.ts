import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkspaceRole } from '@prisma/client';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';
import { PresenceService } from '../realtime/presence.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class WorkspaceMembersService {
  constructor(
    private prisma: PrismaService,
    private readonly presenceService: PresenceService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async getWorkspaceMembers(
    currentPage: string | undefined,
    limit: string | undefined,
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
    actorId: string,
  ) {
    this.ensureValidWorkspaceRole(role);

    // Fetch actor and target membership in parallel
    const [actor, member] = await Promise.all([
      this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: actorId,
          leftAt: null,
          workspace: { isDeleted: false },
        },
        select: { role: true },
      }),
      this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
          leftAt: null,
          workspace: { isDeleted: false },
        },
        select: { role: true },
      }),
    ]);

    if (!actor) {
      throw new ForbiddenException(
        'You are not an active member of this workspace',
      );
    }

    if (!member) {
      throw new BadRequestException(
        'User is not an active member of this workspace',
      );
    }

    if (member.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Workspace owner role cannot be changed');
    }

    // Only OWNER can grant or revoke ADMIN role
    if (role === WorkspaceRole.ADMIN || member.role === WorkspaceRole.ADMIN) {
      if (actor.role !== WorkspaceRole.OWNER) {
        throw new ForbiddenException(
          'Only workspace owner can grant or revoke the admin role',
        );
      }
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

    const updatedMember = await this.prisma.workspaceMember.update({
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

    const lastSeenAt = new Date().toISOString();
    const { affectedSocketIds } =
      await this.presenceService.forceLeaveWorkspace(userId, workspaceId);

    this.realtimeService.emitUserPresence({
      userId,
      workspaceId,
      status: 'offline',
      lastSeenAt,
    });
    this.realtimeService.forceLeaveWorkspaceRoom(
      affectedSocketIds,
      workspaceId,
    );

    return updatedMember;
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
