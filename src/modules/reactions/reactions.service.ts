import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { v7 as uuidv7 } from 'uuid';
import {
  CreateReactionResult,
  ReactionSummary,
  reactionUserSelect,
} from './types/reaction.type';
import { ReactionDto } from './dto/reaction.dto';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async toggleReaction(userId: string, messageId: string, dto: ReactionDto) {
    const reactionId = uuidv7();
    const { emoji } = dto;
    const message = await this.ensureReadableMessage(messageId, userId);

    const existingReaction = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
      include: {
        user: {
          select: reactionUserSelect,
        },
      },
    });

    if (existingReaction) {
      return {
        message: 'Reaction already exists',
        reaction: existingReaction,
      };
    }

    const { created, reaction } = await this.createReactionOrReturnExisting(
      reactionId,
      messageId,
      userId,
      emoji,
    );

    if (created) {
      this.realtimeService.emitReactionAdded({
        conversationId: message.conversationId,
        messageId,
        userId,
        emoji,
        user: reaction.user,
      });
    }

    return reaction;
  }

  async removeReaction(userId: string, messageId: string, dto: ReactionDto) {
    const { emoji } = dto;
    const message = await this.ensureReadableMessage(messageId, userId);

    const existingReaction = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
      include: {
        user: {
          select: reactionUserSelect,
        },
      },
    });

    if (!existingReaction) {
      throw new NotFoundException('Reaction not found');
    }

    const deletedReaction = await this.prisma.reaction.delete({
      where: {
        id: existingReaction.id,
      },
    });

    this.realtimeService.emitReactionRemoved({
      conversationId: message.conversationId,
      messageId,
      userId,
      emoji,
      user: existingReaction.user,
    });

    return deletedReaction;
  }

  async getReactions(
    messageId: string,
    userId: string,
  ): Promise<ReactionSummary[]> {
    await this.ensureReadableMessage(messageId, userId);

    const result = await this.prisma.$queryRaw<ReactionSummary[]>`
        SELECT 
            emoji,
            COUNT(*)::INT as count,
            BOOL_OR(user_id = ${userId}::uuid) as "reactedByMe"
        FROM reactions
        WHERE message_id = ${messageId}::uuid
        GROUP BY emoji
        ORDER BY count DESC, emoji ASC;
        `;

    return result;
  }

  private async ensureReadableMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        isDeleted: false,
        conversation: {
          isDeleted: false,
          workspace: {
            isDeleted: false,
            members: {
              some: { userId, leftAt: null },
            },
          },
          members: {
            some: { userId, leftAt: null },
          },
        },
      },
      include: {
        conversation: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  private async createReactionOrReturnExisting(
    reactionId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<CreateReactionResult> {
    try {
      const reaction = await this.prisma.reaction.create({
        data: {
          id: reactionId,
          messageId,
          userId,
          emoji,
        },
        include: {
          user: {
            select: reactionUserSelect,
          },
        },
      });

      return {
        created: true,
        reaction,
      };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existingReaction = await this.prisma.reaction.findUnique({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId,
            emoji,
          },
        },
        include: {
          user: {
            select: reactionUserSelect,
          },
        },
      });

      if (!existingReaction) {
        throw error;
      }

      return {
        created: false,
        reaction: {
          message: 'Reaction already exists',
          reaction: existingReaction,
        },
      };
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
