import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { PrismaService } from 'prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { SocketAuthGuard } from '../../common/guards/socket-auth.guard';
import { EVENTS } from '../../shared/constants/socket-event.constant';
import { ROOMS } from '../../shared/constants/socket-room.constant';
import { SocketData } from '../../shared/interfaces/socket-data.interface';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/interfaces/socket-events.interface';
import { InterServerEvents } from '../../shared/types/inter-server.type';

export type TypedSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type ConversationAccess = {
  id: string;
  workspaceId: string;
  user: {
    displayName: string | null;
  };
};

@WebSocketGateway({
  cors: { origin: process.env.FE_DOMAIN, credentials: true },
  namespace: '/',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: TypedSocketServer;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: TypedSocket): void {
    this.logger.debug(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: TypedSocket): void {
    const { userId } = client.data;

    if (userId) {
      this.removeUserSocket(userId, client.id);
    }

    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @UseGuards(SocketAuthGuard)
  @SubscribeMessage(EVENTS.JOIN_WORKSPACE)
  async handleJoinWorkspace(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() workspaceId: string,
  ): Promise<void> {
    const userId = this.getAuthenticatedUserId(client);

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        leftAt: null,
        workspace: {
          isDeleted: false,
        },
      },
      select: {
        id: true,
      },
    });

    if (!member) {
      throw new WsException('Not a workspace member');
    }

    client.data.workspaceId = workspaceId;
    this.addUserSocket(userId, client.id);
    await client.join(ROOMS.workspace(workspaceId));
    await client.join(ROOMS.user(userId));
  }

  @UseGuards(SocketAuthGuard)
  @SubscribeMessage(EVENTS.JOIN_CONVERSATION)
  async handleJoinConversation(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    await this.ensureConversationAccess(client, conversationId);
    await client.join(ROOMS.conversation(conversationId));
  }

  @UseGuards(SocketAuthGuard)
  @SubscribeMessage(EVENTS.LEAVE_CONVERSATION)
  async handleLeaveConversation(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    await client.leave(ROOMS.conversation(conversationId));
  }

  @UseGuards(SocketAuthGuard)
  @SubscribeMessage(EVENTS.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    await this.broadcastTyping(client, conversationId);
  }

  @UseGuards(SocketAuthGuard)
  @SubscribeMessage(EVENTS.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    await this.broadcastTyping(client, conversationId);
  }

  getServer(): TypedSocketServer {
    return this.server;
  }

  private addUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.userSockets.set(userId, sockets);
  }

  private removeUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.userSockets.delete(userId);
    }
  }

  private async broadcastTyping(
    client: TypedSocket,
    conversationId: string,
  ): Promise<void> {
    const userId = this.getAuthenticatedUserId(client);
    const access = await this.ensureConversationAccess(client, conversationId);

    client.to(ROOMS.conversation(conversationId)).emit(EVENTS.TYPING, {
      conversationId,
      userId,
      displayName: access.user.displayName,
    });
  }

  private async ensureConversationAccess(
    client: TypedSocket,
    conversationId: string,
  ): Promise<ConversationAccess> {
    const userId = this.getAuthenticatedUserId(client);
    const { workspaceId } = client.data;

    if (!workspaceId) {
      throw new WsException('Join a workspace before joining conversations');
    }

    const membership = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null,
        conversation: {
          workspaceId,
          isDeleted: false,
          isArchived: false,
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
      select: {
        conversation: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
        user: {
          select: {
            displayName: true,
          },
        },
      },
    });

    if (!membership) {
      throw new WsException('Not a conversation member');
    }

    return {
      id: membership.conversation.id,
      workspaceId: membership.conversation.workspaceId,
      user: membership.user,
    };
  }

  private getAuthenticatedUserId(client: TypedSocket): string {
    const { userId } = client.data;

    if (!userId) {
      throw new WsException('Socket is not authenticated');
    }

    return userId;
  }
}
