import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'prisma/prisma.service';
import { UserInterface } from 'src/shared/interfaces/users.interface';

type WorkspaceMemberRequest = Omit<Request, 'body' | 'params'> & {
  user: UserInterface;
  workspaceMember?: unknown;
  workspace?: unknown;
  workspaceId?: string;
  params: {
    conversationId?: string;
    id?: string;
    inviteId?: string;
    workspaceId?: string;
  };
  body?: {
    workspaceId?: unknown;
  };
};

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<WorkspaceMemberRequest>();

    const userId = request.user.id;
    const workspaceId = await this.resolveWorkspaceId(request);

    if (!workspaceId) {
      throw new ForbiddenException();
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!member) {
      throw new ForbiddenException();
    }

    request.workspaceMember = member;
    request.workspace = member.workspace;
    request.workspaceId = member.workspaceId;

    return true;
  }

  private async resolveWorkspaceId(request: WorkspaceMemberRequest) {
    const directWorkspaceId =
      request.params?.workspaceId ??
      request.params?.id ??
      (typeof request.body?.workspaceId === 'string'
        ? request.body.workspaceId
        : undefined);

    if (directWorkspaceId) {
      return directWorkspaceId;
    }

    const inviteId = request.params?.inviteId;
    if (!inviteId) {
      return this.resolveWorkspaceIdFromConversation(
        request.params?.conversationId,
      );
    }

    const invite = await this.prisma.workspaceInvite.findUnique({
      where: {
        id: inviteId,
      },
      select: {
        workspaceId: true,
      },
    });

    return invite?.workspaceId;
  }

  private async resolveWorkspaceIdFromConversation(conversationId?: string) {
    if (!conversationId) {
      return undefined;
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        isDeleted: false,
      },
      select: {
        workspaceId: true,
      },
    });

    return conversation?.workspaceId;
  }
}
