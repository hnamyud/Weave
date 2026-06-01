import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import { WorkspaceInviteType, WorkspaceRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { WorkspaceInviteResponseStatus } from '@prisma/client';
import {
  DirectInviteResponseDto,
  LinkInviteResponseDto,
} from './dto/invite-response.dto';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { MailService } from '../mailer/mail.service';
import type {
  CreateDirectInviteInput,
  CreateInviteLinkInput,
  GetWorkspaceInvitesInput,
  InviteListStatus,
} from './types/workspace-invite.type';

@Injectable()
export class WorkspaceInviteService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async createDirectInvite(dto: CreateDirectInviteInput, createdById: string) {
    const invitedEmail = this.normalizeEmail(dto.invitedEmail);
    const inviter = await this.ensureActiveWorkspaceMember(
      dto.workspaceId,
      createdById,
    );
    await this.ensureEmailIsNotWorkspaceMember(dto.workspaceId, invitedEmail);
    await this.ensureNoPendingDirectInvite(dto.workspaceId, invitedEmail);
    const expiresInDays = this.getInviteExpiresInDays();
    const rawToken = randomBytes(16).toString('base64url');
    const inviteUrl = `${this.getInviteBaseUrl()}${rawToken}`;

    try {
      await this.prisma.workspaceInvite.create({
        data: {
          id: uuidv7(),
          workspaceId: dto.workspaceId,
          type: WorkspaceInviteType.DIRECT,
          invitedEmail,
          rawToken,
          role: WorkspaceRole.MEMBER,
          createdById: createdById,
          expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      this.handleInviteMutationError(error);
    }

    await this.mailService.sendWorkspaceInviteEmail({
      invitedEmail,
      inviteUrl,
      workspaceName: inviter.workspace.name,
      inviterName:
        inviter.user.displayName ?? inviter.user.username ?? inviter.user.email,
    });

    return inviteUrl;
  }

  async createInviteLink(dto: CreateInviteLinkInput, createdById: string) {
    this.ensureValidExpiration(dto.expiresAt);
    await this.ensureActiveWorkspaceMember(dto.workspaceId, createdById);

    const activeLinkInvite = await this.findActiveLinkInvite(dto.workspaceId);
    if (activeLinkInvite?.rawToken) {
      return `${this.getInviteBaseUrl()}${activeLinkInvite.rawToken}`;
    }
    if (activeLinkInvite) {
      await this.revokeActiveLinkInvite(activeLinkInvite.id);
    }

    const rawToken = randomBytes(16).toString('base64url');
    const inviteUrl = `${this.getInviteBaseUrl()}${rawToken}`;
    try {
      await this.prisma.workspaceInvite.create({
        data: {
          id: uuidv7(),
          workspaceId: dto.workspaceId,
          type: WorkspaceInviteType.LINK,
          rawToken,
          role: WorkspaceRole.MEMBER,
          createdById: createdById,
          expiresAt: dto.expiresAt,
        },
      });
    } catch (error) {
      this.handleInviteMutationError(error);
    }
    return inviteUrl;
  }

  async acceptDirectInvite(
    dto: DirectInviteResponseDto,
    currentUser: Pick<UserInterface, 'id' | 'email'>,
  ) {
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: {
        type: WorkspaceInviteType.DIRECT,
        rawToken: dto.token,
        revokedAt: null,
      },
    });

    if (!invite) {
      throw new BadRequestException('Invite not found');
    }

    if (invite.type !== WorkspaceInviteType.DIRECT) {
      throw new BadRequestException('Invalid invite type');
    }

    this.ensureInviteIsUsable(invite);

    if (invite.invitedEmail !== this.normalizeEmail(currentUser.email)) {
      throw new BadRequestException(
        'You are not the invited user for this invite',
      );
    }

    return this.acceptInviteInTransaction(
      invite.id,
      invite.workspaceId,
      currentUser.id,
    );
  }

  async acceptLinkInvite(dto: LinkInviteResponseDto, currentUserId: string) {
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: {
        type: WorkspaceInviteType.LINK,
        rawToken: dto.token,
        revokedAt: null,
      },
    });

    if (!invite) {
      throw new BadRequestException('Invite not found');
    }

    this.ensureInviteIsUsable(invite);

    return this.acceptInviteInTransaction(
      invite.id,
      invite.workspaceId,
      currentUserId,
    );
  }

  async denyInvite(
    dto: DirectInviteResponseDto,
    currentUser: Pick<UserInterface, 'id' | 'email'>,
  ) {
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: {
        type: WorkspaceInviteType.DIRECT,
        rawToken: dto.token,
        revokedAt: null,
      },
    });

    if (!invite) {
      throw new BadRequestException('Invite not found');
    }

    if (invite.type !== WorkspaceInviteType.DIRECT) {
      throw new BadRequestException('Link invites cannot be denied');
    }

    this.ensureInviteIsUsable(invite);

    if (invite.invitedEmail !== this.normalizeEmail(currentUser.email)) {
      throw new BadRequestException(
        'You are not the invited user for this invite',
      );
    }

    try {
      return await this.prisma.workspaceInviteResponse.create({
        data: {
          id: uuidv7(),
          inviteId: invite.id,
          userId: currentUser.id,
          status: WorkspaceInviteResponseStatus.DENIED,
        },
      });
    } catch (error) {
      this.handleInviteMutationError(error);
    }
  }

  async revokeInvite(inviteId: string, currentUserId: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new BadRequestException('Invite not found');
    }

    if (invite.revokedAt) {
      throw new BadRequestException('Invite has already been revoked');
    }

    await this.ensureActiveWorkspaceMember(invite.workspaceId, currentUserId);

    try {
      return await this.prisma.workspaceInvite.update({
        where: {
          id: inviteId,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } catch (error) {
      this.handleInviteMutationError(error);
    }
  }

  async getWorkspaceInvites(input: GetWorkspaceInvitesInput) {
    const page = parsePositiveInteger(input.currentPage, 1, 'currentPage');
    const pageSize = parsePositiveInteger(input.limit, 10, 'limit');
    const offset = (page - 1) * pageSize;
    const type = this.parseInviteType(input.type);
    const status = this.parseInviteStatus(input.status);
    await this.ensureActiveWorkspaceMember(
      input.workspaceId,
      input.requesterId,
    );

    const where = {
      workspaceId: input.workspaceId,
      workspace: {
        isDeleted: false,
      },
      ...(type ? { type } : {}),
      ...(status === 'ACTIVE'
        ? {
            revokedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          }
        : {}),
    };

    const totalItems = await this.prisma.workspaceInvite.count({
      where,
    });
    const totalPages = Math.ceil(totalItems / pageSize);
    const result = await this.prisma.workspaceInvite.findMany({
      where,
      skip: offset,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        rawToken: true,
        invitedEmail: true,
        role: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            responses: {
              where: {
                status: WorkspaceInviteResponseStatus.ACCEPTED,
              },
            },
          },
        },
      },
    });

    const mappedResult = result.map(({ _count, ...invite }) => ({
      ...this.omitRawToken(invite),
      ...(invite.type === WorkspaceInviteType.LINK
        ? {
            inviteUrl: invite.rawToken
              ? `${this.getInviteBaseUrl()}${invite.rawToken}`
              : null,
            usageCount: _count.responses,
          }
        : {}),
    }));

    return {
      meta: {
        current: page, // trang hiện tại
        pageSize: pageSize, // số lượng bản ghi đã lấy
        pages: totalPages, // tổng số trang
        total: totalItems, // tổng số phần tử
      },
      result: mappedResult,
    };
  }

  // Helper methods

  private async acceptInviteInTransaction(
    inviteId: string,
    workspaceId: string,
    userId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const response = await tx.workspaceInviteResponse.create({
          data: {
            id: uuidv7(),
            inviteId,
            userId,
            status: WorkspaceInviteResponseStatus.ACCEPTED,
          },
        });

        await tx.workspaceMember.create({
          data: {
            id: uuidv7(),
            workspaceId,
            userId,
            role: WorkspaceRole.MEMBER,
          },
        });

        return response;
      });
    } catch (error) {
      this.handleInviteMutationError(error);
    }
  }

  private ensureInviteIsUsable(invite: {
    expiresAt: Date;
    revokedAt: Date | null;
  }) {
    if (invite.revokedAt) {
      throw new BadRequestException('Invite has been revoked');
    }

    if (invite.expiresAt <= new Date()) {
      throw new BadRequestException('Invite has expired');
    }
  }

  private async ensureEmailIsNotWorkspaceMember(
    workspaceId: string,
    email: string,
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: {
          email,
        },
        leftAt: null,
      },
    });

    if (member) {
      throw new BadRequestException(
        'User is already a member of this workspace',
      );
    }
  }

  private async ensureActiveWorkspaceMember(
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
        id: true,
        workspace: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            email: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    if (!member) {
      throw new BadRequestException(
        'User is not an active member of this workspace',
      );
    }

    return member;
  }

  private async ensureNoPendingDirectInvite(
    workspaceId: string,
    invitedEmail: string,
  ) {
    const existingInvite = await this.prisma.workspaceInvite.findFirst({
      where: {
        workspaceId,
        invitedEmail,
        type: WorkspaceInviteType.DIRECT,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
        responses: {
          none: {},
        },
      },
    });

    if (existingInvite) {
      throw new BadRequestException(
        'A pending direct invite already exists for this user',
      );
    }
  }

  private getInviteExpiresInDays() {
    const value = Number(this.configService.get('INVITE_EXPIRES_IN_DAYS'));

    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(
        'INVITE_EXPIRES_IN_DAYS must be a positive number',
      );
    }

    return value;
  }

  private getInviteBaseUrl() {
    const url = this.configService.get<string>('URL_INVITE');

    if (!url) {
      throw new BadRequestException('URL_INVITE is required');
    }

    return url;
  }

  private ensureValidExpiration(expiresAt: Date) {
    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Expiration date must be valid');
    }

    if (expiresAt <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }
  }

  private findActiveLinkInvite(workspaceId: string) {
    return this.prisma.workspaceInvite.findFirst({
      where: {
        workspaceId,
        type: WorkspaceInviteType.LINK,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        rawToken: true,
      },
    });
  }

  private revokeActiveLinkInvite(inviteId: string) {
    return this.prisma.workspaceInvite.update({
      where: {
        id: inviteId,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private parseInviteType(type?: string) {
    if (!type) {
      return undefined;
    }

    const normalizedType = type.toUpperCase();
    const inviteType = Object.values(WorkspaceInviteType).find(
      (value) => value === normalizedType,
    );

    if (!inviteType) {
      throw new BadRequestException('Invalid invite type');
    }

    return inviteType;
  }

  private parseInviteStatus(status?: string): InviteListStatus | undefined {
    if (!status) {
      return undefined;
    }

    const normalizedStatus = status.toUpperCase();

    if (normalizedStatus !== 'ACTIVE') {
      throw new BadRequestException('Invalid invite status');
    }

    return normalizedStatus;
  }

  private omitRawToken<T extends { rawToken?: string | null }>(invite: T) {
    return Object.fromEntries(
      Object.entries(invite).filter(([key]) => key !== 'rawToken'),
    ) as Omit<T, 'rawToken'>;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private handleInviteMutationError(error: unknown): never {
    if (this.isPrismaError(error, 'P2002')) {
      throw new BadRequestException(
        'Invite has already been used or responded to',
      );
    }

    if (this.isPrismaError(error, 'P2003')) {
      throw new BadRequestException(
        'Invite, workspace, or user does not exist',
      );
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
