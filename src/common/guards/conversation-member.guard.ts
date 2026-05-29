import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ConversationMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
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
