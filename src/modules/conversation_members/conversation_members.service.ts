import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';
import { v7 as uuidv7 } from 'uuid';
import { ConversationRole } from '@prisma/client';

@Injectable()
export class ConversationMembersService {
  constructor(private prisma: PrismaService) {}

  async getConversationMembers(
    currentPage: string | undefined,
    limit: string | undefined,
    conversationId: string,
    requesterId: string,
  ) {
    const page = parsePositiveInteger(currentPage, 1, 'currentPage');
    const pageSize = parsePositiveInteger(limit, 10, 'limit');
    const offset = (page - 1) * pageSize;
    await this.ensureConversationMember(conversationId, requesterId);

    const where = {
      conversationId,
      leftAt: null,
    };

    const totalItems = await this.prisma.conversationMember.count({
      where,
    });
    const totalPages = Math.ceil(totalItems / pageSize);
    const result = await this.prisma.conversationMember.findMany({
      where,
      skip: offset,
      take: pageSize,
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        joinedAt: true,
        lastReadAt: true,
        isMuted: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            statusText: true,
            statusEmoji: true,
            lastSeenAt: true,
          },
        },
      },
    });

    return {
      meta: {
        current: page,
        pageSize: pageSize,
        pages: totalPages,
        total: totalItems,
      },
      result,
    };
  }

  async searchMentionCandidates(
    conversationId: string,
    requesterId: string,
    query?: string,
  ) {
    await this.ensureConversationMember(conversationId, requesterId);

    const q = query?.trim();
    const result = await this.prisma.conversationMember.findMany({
      where: {
        conversationId,
        leftAt: null,
        user: {
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  {
                    username: {
                      contains: q,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    displayName: {
                      contains: q,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {}),
        },
      },
      take: 20,
      orderBy: {
        joinedAt: 'asc',
      },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return result.map((member) => member.user);
  }

  async addConversationMember(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!member) {
      return await this.prisma.conversationMember.create({
        data: {
          id: uuidv7(),
          conversationId,
          userId,
          role: ConversationRole.MEMBER,
        },
      });
    }

    if (member.leftAt) {
      return await this.prisma.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: { leftAt: null },
      });
    }

    if (member.leftAt === null) {
      throw new BadRequestException(
        'User is already a member of this conversation',
      );
    }
  }

  async removeConversationMember(conversationId: string, userId: string) {
    await this.ensureConversationMember(conversationId, userId);
    await this.ensureNotLastAdmin(conversationId, userId);

    return await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        leftAt: new Date(),
      },
    });
  }

  private async ensureConversationMember(
    conversationId: string,
    userId: string,
  ) {
    const member = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null,
      },
    });

    if (!member) {
      throw new BadRequestException(
        'User is not a member of this conversation',
      );
    }
  }

  private async ensureNotLastAdmin(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId, leftAt: null },
    });

    if (!member || member.role !== ConversationRole.ADMIN) return;

    const adminCount = await this.prisma.conversationMember.count({
      where: {
        conversationId,
        role: ConversationRole.ADMIN,
        leftAt: null,
      },
    });

    if (adminCount <= 1) {
      throw new BadRequestException(
        'Cannot remove the last admin. Transfer admin role to another member first.',
      );
    }
  }
}
