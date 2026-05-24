import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { v7 as uuidv7 } from 'uuid';
import { ConversationRole } from 'src/shared/enums/conversation-role.enum';

@Injectable()
export class ConversationService {
    constructor(
        private prisma: PrismaService,
    ) { }

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
                }
            });

            await tx.conversationMember.create({
                data: {
                    id: uuidv7(),
                    conversationId: id,
                    userId: userId,
                    role: ConversationRole.Admin,
                }
            });

            return conversation;
        });
    }

    private async ensureActiveWorkspaceMember(workspaceId: string, userId: string) {
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
            throw new BadRequestException('User is not an active member of this workspace');
        }
    }
}
