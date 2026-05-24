import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { parsePositiveInteger } from '../../common/utils/parse-interger.utils';

@Injectable()
export class ConversationMembersService {
    constructor(
        private prisma: PrismaService,
    ) { }

    async getConversationMembers(
        currentPage: number,
        limit: number,
        conversationId: string,
        requesterId: string,
    ) {
        const page = parsePositiveInteger(currentPage, 1, 'currentPage');
        const pageSize = parsePositiveInteger(limit, 10, 'limit');
        const offset = (page - 1) * pageSize;

        await this.ensureConversationMember(conversationId, requesterId);

        const where = {
            conversationId,
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

    private async ensureConversationMember(conversationId: string, userId: string) {
        const member = await this.prisma.conversationMember.findFirst({
            where: {
                conversationId,
                userId,
            },
        });

        if (!member) {
            throw new BadRequestException('User is not a member of this conversation');
        }
    }
}
