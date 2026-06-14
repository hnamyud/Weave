import { BadRequestException, Injectable } from '@nestjs/common';
import { ConversationType, ConversationRole } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { v7 as uuidv7 } from 'uuid';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationMembersService } from '../conversation_members/conversation_members.service';
import {
  ConversationListItem,
  conversationListSelect,
  ConversationResponse,
  conversationSelect,
  ConversationWithCount,
} from './types/conversation.type';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { RealtimeService } from '../realtime/realtime.service';

type ConversationContextOptions = {
  conversationWhere?: {
    isArchived?: boolean;
  };
  notFoundMessage?: string;
};

@Injectable()
export class ConversationService {
  constructor(
    private prisma: PrismaService,
    private conversationMembersService: ConversationMembersService,
    private realtimeService: RealtimeService,
  ) {}

  async createConversation(dto: CreateConversationDto, userId: string) {
    await this.ensureActiveWorkspaceMember(dto.workspaceId, userId);

    switch (dto.type) {
      case ConversationType.DM:
        return this.createDmConversation(dto, userId);
      case ConversationType.GROUP_DM:
        return this.createGroupDmConversation(dto, userId);
      case ConversationType.CHANNEL:
        return this.createChannelConversation(dto, userId);
    }
  }

  private async createChannelConversation(
    dto: CreateConversationDto,
    userId: string,
  ) {
    const id = uuidv7();
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          id,
          workspaceId: dto.workspaceId,
          type: ConversationType.CHANNEL,
          name: dto.name,
          description: dto.description,
          isPrivate: dto.isPrivate,
          createdBy: userId,
        },
      });
      await tx.conversationMember.create({
        data: {
          id: uuidv7(),
          conversationId: id,
          userId,
          role: ConversationRole.ADMIN,
        },
      });
      return conversation;
    });
  }

  private async createDmConversation(
    dto: CreateConversationDto,
    userId: string,
  ) {
    // Validate memberIds
    if (!dto.memberIds || dto.memberIds.length !== 1) {
      throw new BadRequestException(
        'DM requires exactly one target user in memberIds',
      );
    }
    const targetId = dto.memberIds[0];

    // No self-DM
    if (targetId === userId) {
      throw new BadRequestException('Cannot create a DM with yourself');
    }

    // Target must be active workspace member
    await this.ensureActiveWorkspaceMember(dto.workspaceId, targetId);

    // Dedup: return existing active DM between the same pair
    const existing = await this.findExistingDm(
      dto.workspaceId,
      userId,
      targetId,
    );
    if (existing) return existing;

    // Create DM + seed both participants in one transaction
    const id = uuidv7();
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          id,
          workspaceId: dto.workspaceId,
          type: ConversationType.DM,
          isPrivate: true,
          createdBy: userId,
        },
      });
      await tx.conversationMember.createMany({
        data: [
          {
            id: uuidv7(),
            conversationId: id,
            userId,
            role: ConversationRole.ADMIN,
          },
          {
            id: uuidv7(),
            conversationId: id,
            userId: targetId,
            role: ConversationRole.MEMBER,
          },
        ],
      });
      return conversation;
    });
  }

  private async createGroupDmConversation(
    dto: CreateConversationDto,
    userId: string,
  ) {
    // Validate memberIds
    if (!dto.memberIds || dto.memberIds.length < 1) {
      throw new BadRequestException(
        'GROUP_DM requires at least one other user in memberIds',
      );
    }

    // Creator must not be in the list
    if (dto.memberIds.includes(userId)) {
      throw new BadRequestException(
        'memberIds must not include the creator (yourself)',
      );
    }

    // All targets must be active workspace members
    await Promise.all(
      dto.memberIds.map((id) =>
        this.ensureActiveWorkspaceMember(dto.workspaceId, id),
      ),
    );

    // Create GROUP_DM + seed all participants in one transaction
    const id = uuidv7();
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          id,
          workspaceId: dto.workspaceId,
          type: ConversationType.GROUP_DM,
          name: dto.name,
          isPrivate: true,
          createdBy: userId,
        },
      });
      await tx.conversationMember.createMany({
        data: [
          {
            id: uuidv7(),
            conversationId: id,
            userId,
            role: ConversationRole.ADMIN,
          },
          ...dto.memberIds!.map((memberId) => ({
            id: uuidv7(),
            conversationId: id,
            userId: memberId,
            role: ConversationRole.MEMBER,
          })),
        ],
      });
      return conversation;
    });
  }

  private async findExistingDm(
    workspaceId: string,
    userIdA: string,
    userIdB: string,
  ) {
    return this.prisma.conversation.findFirst({
      where: {
        workspaceId,
        type: ConversationType.DM,
        isDeleted: false,
        AND: [
          { members: { some: { userId: userIdA, leftAt: null } } },
          { members: { some: { userId: userIdB, leftAt: null } } },
        ],
      },
    });
  }

  async updateConversation(
    conversationId: string,
    dto: UpdateConversationDto,
    userId: string,
  ) {
    await this.getConversationMemberContext(conversationId, userId, {
      notFoundMessage:
        'Conversation not found or user is not a member of this conversation',
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        name: dto.name,
        description: dto.description,
        isPrivate: dto.isPrivate,
        updatedAt: new Date(),
      },
    });

    this.realtimeService.emitConversationUpdated({
      conversationId,
      workspaceId: updated.workspaceId,
      name: updated.name,
      type: updated.type,
      isPrivate: updated.isPrivate,
      isArchived: updated.isArchived,
    });

    return updated;
  }

  async softDeleteConversation(conversationId: string, userId: string) {
    await this.getConversationMemberContext(conversationId, userId, {
      notFoundMessage:
        'Conversation not found or user is not a member of this conversation',
    });

    const deleted = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    this.realtimeService.emitConversationDeleted({
      conversationId,
      workspaceId: deleted.workspaceId,
    });

    return deleted;
  }

  async archiveConversation(conversationId: string, userId: string) {
    await this.getConversationMemberContext(conversationId, userId, {
      conversationWhere: {
        isArchived: false,
      },
      notFoundMessage:
        'Conversation not found, already archived, or user is not a member of this conversation',
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isArchived: true,
        updatedAt: new Date(),
      },
    });

    this.realtimeService.emitConversationUpdated({
      conversationId,
      workspaceId: updated.workspaceId,
      name: updated.name,
      type: updated.type,
      isPrivate: updated.isPrivate,
      isArchived: true,
    });

    return updated;
  }

  async unarchiveConversation(conversationId: string, userId: string) {
    await this.getConversationMemberContext(conversationId, userId, {
      conversationWhere: {
        isArchived: true,
      },
      notFoundMessage:
        'Conversation not found, not archived, or user is not a member of this conversation',
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isArchived: false,
        updatedAt: new Date(),
      },
    });

    this.realtimeService.emitConversationUpdated({
      conversationId,
      workspaceId: updated.workspaceId,
      name: updated.name,
      type: updated.type,
      isPrivate: updated.isPrivate,
      isArchived: false,
    });

    return updated;
  }

  async getConversationById(
    conversationId: string,
    userId: string,
  ): Promise<ConversationResponse> {
    await this.getConversationMemberContext(conversationId, userId, {
      notFoundMessage:
        'Conversation not found or user is not a member of this conversation',
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
        isDeleted: false,
      },
      select: conversationSelect,
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    return this.mapConversation(conversation);
  }

  async listUserConversations(
    userId: string,
    query: ListConversationsQueryDto,
  ): Promise<ConversationListItem[]> {
    await this.ensureActiveWorkspaceMember(query.workspaceId, userId);

    const members = await this.prisma.conversationMember.findMany({
      where: {
        userId,
        leftAt: null,
        conversation: {
          workspaceId: query.workspaceId,
          isDeleted: false,
          ...(query.type !== undefined ? { type: query.type } : {}),
          ...(query.isArchived !== undefined
            ? { isArchived: query.isArchived }
            : {}),
          ...(query.isPrivate !== undefined
            ? { isPrivate: query.isPrivate }
            : {}),
        },
      },
      select: {
        role: true,
        lastReadAt: true,
        conversation: {
          select: conversationListSelect,
        },
      },
      orderBy: { conversation: { createdAt: 'desc' } },
    });

    return members.map((m) => ({
      id: m.conversation.id,
      name: m.conversation.name,
      type: m.conversation.type,
      isPrivate: m.conversation.isPrivate,
      myRole: m.role,
      lastReadAt: m.lastReadAt,
    }));
  }

  async getConversationsByWorkspace(workspaceId: string, userId: string) {
    return await this.prisma.conversation.findMany({
      where: {
        workspaceId,
        isDeleted: false,
        members: {
          some: {
            userId,
            leftAt: null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        isPrivate: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  private async getConversationMemberContext(
    conversationId: string,
    userId: string,
    options: ConversationContextOptions = {},
  ) {
    const member = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null,
        conversation: {
          isDeleted: false,
          ...options.conversationWhere,
          workspace: {
            isDeleted: false,
            members: {
              some: {
                userId,
                leftAt: null,
              },
            },
          },
        },
      },
      include: {
        conversation: true,
      },
    });

    if (!member) {
      throw new BadRequestException(
        options.notFoundMessage ?? 'User is not a member of this conversation',
      );
    }

    return member;
  }

  // Public channel
  async joinChannel(conversationId: string, userId: string) {
    const channel = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        isDeleted: false,
        isArchived: false,
        isPrivate: false,
        type: ConversationType.CHANNEL,
      },
    });
    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    const result = await this.conversationMembersService.addConversationMember(
      conversationId,
      userId,
    );

    const joinedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, avatarUrl: true, username: true },
    });

    if (joinedUser) {
      this.realtimeService.emitMemberJoined({
        conversationId,
        workspaceId: channel.workspaceId,
        user: joinedUser,
      });
    }

    return result;
  }

  async leaveChannel(conversationId: string, userId: string) {
    const channel = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        isDeleted: false,
        isArchived: false,
        isPrivate: false,
      },
    });

    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    if (channel.type === ConversationType.DM) {
      throw new BadRequestException('Cannot leave a DM conversation');
    }

    const result =
      await this.conversationMembersService.removeConversationMember(
        conversationId,
        userId,
      );

    const leftUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, avatarUrl: true, username: true },
    });

    if (leftUser) {
      this.realtimeService.emitMemberLeft({
        conversationId,
        workspaceId: channel.workspaceId,
        user: leftUser,
      });
    }

    return result;
  }

  // Private channel - only added by admin, no self join/leave
  async addMemberToPrivateChannel(conversationId: string, userId: string) {
    const channel = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
        isDeleted: false,
        isPrivate: true,
        type: ConversationType.CHANNEL,
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    await this.ensureActiveWorkspaceMember(channel.workspaceId, userId);

    return await this.conversationMembersService.addConversationMember(
      conversationId,
      userId,
    );
  }

  async removeMemberFromPrivateChannel(
    conversationId: string,
    targetUserId: string,
    actorId: string,
  ) {
    // Self-kick guard: use the leave endpoint instead
    if (targetUserId === actorId) {
      throw new BadRequestException(
        'Cannot kick yourself. Use the leave endpoint instead.',
      );
    }

    // Verify channel exists and is a private channel
    const channel = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
        isDeleted: false,
        isPrivate: true,
        type: ConversationType.CHANNEL,
      },
      select: { id: true },
    });
    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    // Load actor and target membership roles in parallel
    const [actorMember, targetMember] = await Promise.all([
      this.prisma.conversationMember.findFirst({
        where: { conversationId, userId: actorId, leftAt: null },
      }),
      this.prisma.conversationMember.findFirst({
        where: { conversationId, userId: targetUserId, leftAt: null },
      }),
    ]);

    if (!actorMember) {
      throw new BadRequestException('You are not a member of this channel');
    }
    if (!targetMember) {
      throw new BadRequestException(
        'Target user is not a member of this channel',
      );
    }

    // Role hierarchy: conversation admin cannot kick another conversation admin
    if (
      actorMember.role === ConversationRole.ADMIN &&
      targetMember.role === ConversationRole.ADMIN
    ) {
      throw new BadRequestException(
        'Cannot kick another admin. Demote them first.',
      );
    }

    // removeConversationMember internally enforces last-admin protection (#5)
    return await this.conversationMembersService.removeConversationMember(
      conversationId,
      targetUserId,
    );
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
    });

    if (!member) {
      throw new BadRequestException(
        'User is not an active member of this workspace',
      );
    }
  }

  private mapConversation(
    conversation: ConversationWithCount,
  ): ConversationResponse {
    return {
      id: conversation.id,
      name: conversation.name,
      type: conversation.type,
      isPrivate: conversation.isPrivate,
      createdAt: conversation.createdAt,
      memberCount: conversation._count.members,
    };
  }
}
