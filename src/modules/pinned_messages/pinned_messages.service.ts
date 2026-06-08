import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class PinnedMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async pinMessage(messageId: string, userId: string) {
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

    if (message.conversation.isArchived) {
      throw new BadRequestException('Conversation is archived');
    }

    return this.prisma.pinnedMessage.upsert({
      where: { messageId },
      update: {},
      create: {
        id: uuidv7(),
        messageId,
        conversationId: message.conversationId,
        pinnedBy: userId,
      },
    });
  }

  async unpinMessage(messageId: string, userId: string) {
    const pinnedMessage = await this.prisma.pinnedMessage.findFirst({
      where: {
        messageId,
        message: {
          isDeleted: false,
          conversation: {
            isDeleted: false,
            workspace: {
              isDeleted: false,
              members: { some: { userId, leftAt: null } },
            },
            members: { some: { userId, leftAt: null } },
          },
        },
      },
    });

    if (!pinnedMessage) {
      throw new NotFoundException('Pinned message not found');
    }

    return this.prisma.pinnedMessage.delete({
      where: { messageId },
    });
  }
}
