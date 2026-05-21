import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import { CreateDirectInviteDto, CreateInviteLinkDto } from './dto/invite.dto';
import { WorkspaceRole } from '@prisma/client';
import { WorkspaceInviteType } from '../../shared/enums/invite-type.enum';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { WorkspaceInviteResponseStatus } from '../../shared/enums/invite-response-status.enum';
import { DirectInviteResponseDto, LinkInviteResponseDto } from './dto/invite-response.dto';

type CreateInviteLinkInput = CreateInviteLinkDto & { workspaceId: string };
type CreateDirectInviteInput = CreateDirectInviteDto & { workspaceId: string };

@Injectable()
export class WorkspaceInviteService {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) { }

    async createDirectInvite(dto: CreateDirectInviteInput, createdById: string) {
        await this.ensureWorkspaceMember(dto.workspaceId, createdById);
        await this.ensureUserIsNotWorkspaceMember(dto.workspaceId, dto.invitedUserId);
        await this.ensureNoPendingDirectInvite(dto.workspaceId, dto.invitedUserId);
        const expiresInDays = this.getInviteExpiresInDays();

        try {
            return await this.prisma.workspaceInvite.create({
                data: {
                    id: uuidv7(),
                    workspaceId: dto.workspaceId,
                    type: WorkspaceInviteType.Direct,
                    invitedUserId: dto.invitedUserId,
                    role: WorkspaceRole.MEMBER,
                    createdById: createdById,
                    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
                },
            });
        } catch (error) {
            this.handleInviteMutationError(error);
        }
    }

    async createInviteLink(dto: CreateInviteLinkInput, createdById: string) {
        await this.ensureWorkspaceMember(dto.workspaceId, createdById);
        this.ensureValidExpiration(dto.expiresAt);

        const rawToken = randomBytes(16).toString('base64url');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const inviteUrl = `${this.getInviteBaseUrl()}${rawToken}`;
        try {
            await this.prisma.workspaceInvite.create({
                data: {
                    id: uuidv7(),
                    workspaceId: dto.workspaceId,
                    type: WorkspaceInviteType.Link,
                    tokenHash,
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

    async acceptDirectInvite(dto: DirectInviteResponseDto, currentUserId: string) {
        const invite = await this.prisma.workspaceInvite.findUnique({
            where: { id: dto.inviteId },
        });

        if (!invite) {
            throw new BadRequestException('Invite not found');
        }

        if (invite.type !== WorkspaceInviteType.Direct) {
            throw new BadRequestException('Invalid invite type');
        }

        this.ensureInviteIsUsable(invite);

        if (invite.invitedUserId !== currentUserId) {
            throw new BadRequestException('You are not the invited user for this invite');
        }

        return this.acceptInviteInTransaction(invite.id, invite.workspaceId, currentUserId);
    }

    async acceptLinkInvite(dto: LinkInviteResponseDto, currentUserId: string) {
        const tokenHash = createHash('sha256').update(dto.token).digest('hex');
        const invite = await this.prisma.workspaceInvite.findFirst({
            where: {
                type: WorkspaceInviteType.Link,
                tokenHash,
                revokedAt: null,
            },
        });

        if (!invite) {
            throw new BadRequestException('Invite not found');
        }

        this.ensureInviteIsUsable(invite);

        return this.acceptInviteInTransaction(invite.id, invite.workspaceId, currentUserId);
    }

    async denyInvite(dto: DirectInviteResponseDto, currentUserId: string) {
        const invite = await this.prisma.workspaceInvite.findUnique({
            where: { id: dto.inviteId },
        });

        if (!invite) {
            throw new BadRequestException('Invite not found');
        }

        if (invite.type !== WorkspaceInviteType.Direct) {
            throw new BadRequestException('Link invites cannot be denied');
        }

        this.ensureInviteIsUsable(invite);

        if (invite.invitedUserId !== currentUserId) {
            throw new BadRequestException('You are not the invited user for this invite');
        }

        try {
            return await this.prisma.workspaceInviteResponse.create({
                data: {
                    id: uuidv7(),
                    inviteId: dto.inviteId,
                    userId: currentUserId,
                    status: WorkspaceInviteResponseStatus.Denied,
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

        await this.ensureWorkspaceMember(invite.workspaceId, currentUserId);

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

    // Helper methods

    private async acceptInviteInTransaction(inviteId: string, workspaceId: string, userId: string) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const response = await tx.workspaceInviteResponse.create({
                    data: {
                        id: uuidv7(),
                        inviteId,
                        userId,
                        status: WorkspaceInviteResponseStatus.Accepted,
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

    private ensureInviteIsUsable(invite: { expiresAt: Date; revokedAt: Date | null }) {
        if (invite.revokedAt) {
            throw new BadRequestException('Invite has been revoked');
        }

        if (invite.expiresAt <= new Date()) {
            throw new BadRequestException('Invite has expired');
        }
    }

    private async ensureWorkspaceMember(workspaceId: string, userId: string) {
        const member = await this.prisma.workspaceMember.findFirst({
            where: {
                workspaceId,
                userId,
            },
        });

        if (!member) {
            throw new BadRequestException('User is not a member of the workspace');
        }
    }

    private async ensureUserIsNotWorkspaceMember(workspaceId: string, userId: string) {
        const member = await this.prisma.workspaceMember.findFirst({
            where: {
                workspaceId,
                userId,
            },
        });

        if (member) {
            throw new BadRequestException('User is already a member of this workspace');
        }
    }

    private async ensureNoPendingDirectInvite(workspaceId: string, invitedUserId: string) {
        const existingInvite = await this.prisma.workspaceInvite.findFirst({
            where: {
                workspaceId,
                invitedUserId,
                type: WorkspaceInviteType.Direct,
                revokedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
                responses: {
                    none: {
                        userId: invitedUserId,
                    },
                },
            },
        });

        if (existingInvite) {
            throw new BadRequestException('A pending direct invite already exists for this user');
        }
    }

    private getInviteExpiresInDays() {
        const value = Number(this.configService.get('INVITE_EXPIRES_IN_DAYS'));

        if (!Number.isFinite(value) || value <= 0) {
            throw new BadRequestException('INVITE_EXPIRES_IN_DAYS must be a positive number');
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

    private handleInviteMutationError(error: unknown): never {
        if (this.isPrismaError(error, 'P2002')) {
            throw new BadRequestException('Invite has already been used or responded to');
        }

        if (this.isPrismaError(error, 'P2003')) {
            throw new BadRequestException('Invite, workspace, or user does not exist');
        }

        throw error;
    }

    private isPrismaError(error: unknown, code: string) {
        return typeof error === 'object'
            && error !== null
            && 'code' in error
            && error.code === code;
    }
}
