import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Conversation, ConversationMember } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from 'prisma/prisma.service';
import { UserInterface } from 'src/shared/interfaces/users.interface';

type ConversationMemberWithConversation = ConversationMember & {
  conversation: Conversation;
};

type ConversationMemberRequest = Omit<Request, 'params'> & {
  user: UserInterface;
  conversationMember?: ConversationMemberWithConversation;
  conversation?: Conversation;
  workspaceId?: string;
  params: {
    conversationId?: string;
    id?: string;
  };
};

@Injectable()
export class ConversationMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<ConversationMemberRequest>();
    const conversationId = request.params.conversationId ?? request.params.id;
    const userId = request.user.id;

    const member = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null,
        conversation: {
          isDeleted: false,
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
      throw new ForbiddenException();
    }

    request.conversationMember = member;
    request.conversation = member.conversation;
    request.workspaceId = member.conversation.workspaceId;

    return true;
  }
}
