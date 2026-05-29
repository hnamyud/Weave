import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { v7 as uuidv7 } from 'uuid';
import { ConversationRole } from 'src/shared/enums/conversation-role.enum';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationMembersService } from '../conversation_members/conversation_members.service';
import { ConversationType } from 'src/shared/enums/conversation-type.enum';

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
  ) {}

  async createConversation(dto: CreateConversationDto, userId: string) {
    await this.ensureActiveWorkspaceMember(dto.workspaceId, userId);

    const id = uuidv7();
    return await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          id: id,
          workspaceId: dto.workspaceId,
          type: dto.type,
          name: dto.name,
          description: dto.description,
          isPrivate: dto.isPrivate,
          isArchived: dto.isArchived,
          createdBy: userId,
        },
      });

      await tx.conversationMember.create({
        data: {
          id: uuidv7(),
          conversationId: id,
          userId: userId,
          role: ConversationRole.Admin,
        },
      });

      return conversation;
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

    return await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        name: dto.name,
        description: dto.description,
        isPrivate: dto.isPrivate,
        updatedAt: new Date(),
      },
    });
  }

  async softDeleteConversation(conversationId: string, userId: string) {
    await this.getConversationMemberContext(conversationId, userId, {
      notFoundMessage:
        'Conversation not found or user is not a member of this conversation',
    });

    return await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async archiveConversation(conversationId: string, userId: string) {
    await this.getConversationMemberContext(conversationId, userId, {
      conversationWhere: {
        isArchived: false,
      },
      notFoundMessage:
        'Conversation not found, already archived, or user is not a member of this conversation',
    });

    return await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isArchived: true,
        updatedAt: new Date(),
      },
    });
  }

  async unarchiveConversation(conversationId: string, userId: string) {
    await this.getConversationMemberContext(conversationId, userId, {
      conversationWhere: {
        isArchived: true,
      },
      notFoundMessage:
        'Conversation not found, not archived, or user is not a member of this conversation',
    });

    return await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isArchived: false,
        updatedAt: new Date(),
      },
    });
  }

  async getConversationById(conversationId: string, userId: string) {
    await this.getConversationMemberContext(conversationId, userId, {
      notFoundMessage:
        'Conversation not found or user is not a member of this conversation',
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isPrivate: true,
        createdAt: true,

        _count: {
          select: {
            members: {
              where: {
                leftAt: null,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    return conversation;
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
        type: ConversationType.Channel,
      },
    });
    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    return await this.conversationMembersService.addConversationMember(
      conversationId,
      userId,
    );
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

    if (channel.type === ConversationType.Dm) {
      throw new BadRequestException('Cannot leave a DM conversation');
    }

    return await this.conversationMembersService.removeConversationMember(
      conversationId,
      userId,
    );
  }

  // Private channel - only added by admin, no self join/leave
  async addMemberToPrivateChannel(conversationId: string, userId: string) {
    const channel = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
        isDeleted: false,
        isPrivate: true,
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

  async removeMemberFromPrivateChannel(conversationId: string, userId: string) {
    const channel = await this.prisma.conversation.findUnique({
      where: {
        id: conversationId,
        isDeleted: false,
        isPrivate: true,
      },
      select: {
        id: true,
      },
    });

    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    return await this.conversationMembersService.removeConversationMember(
      conversationId,
      userId,
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
}
