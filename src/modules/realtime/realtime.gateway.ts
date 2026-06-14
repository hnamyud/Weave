import { Logger, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'prisma/prisma.service';
import { Queue } from 'bullmq';
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
import { PresenceService } from './presence.service';
import { PresenceLastSeenJobData } from './presence.processor';

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

/**
 * SINGLE-NODE ONLY. Uses Socket.IO's default in-memory adapter, so every
 * `server.to(room).emit(...)` only reaches sockets on this process. Presence
 * state is shared via Redis (PresenceService) but broadcasts are not. Scaling
 * past one instance requires @socket.io/redis-adapter (see InterServerEvents).
 */
@WebSocketGateway({
  cors: { origin: process.env.FE_DOMAIN ?? '*', credentials: true },
  namespace: '/',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: TypedSocketServer;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    @InjectQueue('presence-last-seen')
    private readonly presenceLastSeenQueue: Queue<PresenceLastSeenJobData>,
  ) {}

  afterInit(): void {
    const origin = this.configService.get<string>('FE_DOMAIN');

    if (!origin) {
      this.logger.warn(
        'FE_DOMAIN is not set — WebSocket CORS is open to all origins',
      );
    }
  }

  handleConnection(client: TypedSocket): void {
    this.logger.debug(`Socket connected: ${client.id}`);
  }

  async handleDisconnect(client: TypedSocket): Promise<void> {
    this.logger.debug(`Socket disconnected: ${client.id}`);

    // ASSUMPTION (V1): 1 socket = 1 active workspace presence.
    if (client.data.presenceWorkspaceId) {
      try {
        const result = await this.presenceService.handleDisconnect(client.id);

        if (result?.isLastPresenceInWorkspace) {
          const lastSeenAt = new Date().toISOString();

          this.server
            .to(ROOMS.workspace(result.workspaceId))
            .emit(EVENTS.USER_PRESENCE, {
              userId: result.userId,
              workspaceId: result.workspaceId,
              status: 'offline',
              lastSeenAt,
            });

          // Async persist lastSeenAt to PostgreSQL via BullMQ
          await this.presenceLastSeenQueue.add('persist', {
            userId: result.userId,
            lastSeenAt,
          });
        }
      } catch (err) {
        this.logger.error(
          `Failed to cleanup presence for socket ${client.id}`,
          err,
        );
      }
    }
  }

  @UseGuards(SocketAuthGuard)
  @SubscribeMessage(EVENTS.JOIN_WORKSPACE)
  async handleJoinWorkspace(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() workspaceId: string,
  ): Promise<{ joined: true; roomId: string }> {
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

    const roomId = ROOMS.workspace(workspaceId);
    client.data.workspaceId = workspaceId;
    await client.join(roomId);
    await client.join(ROOMS.user(userId));

    return { joined: true, roomId };
  }

  @UseGuards(SocketAuthGuard)
  @SubscribeMessage(EVENTS.PRESENCE_JOIN)
  async handlePresenceJoin(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() payload: { workspaceId: string },
  ): Promise<{ onlineUserIds: string[] }> {
    const userId = this.getAuthenticatedUserId(client);
    const { workspaceId } = payload;

    // Validate workspace membership
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        leftAt: null,
        workspace: { isDeleted: false },
      },
      select: { id: true },
    });

    if (!member) {
      throw new WsException('Not a workspace member');
    }

    // Workspace switch: clean up old workspace presence before joining new one
    const oldWorkspaceId = client.data.presenceWorkspaceId;
    if (oldWorkspaceId && oldWorkspaceId !== workspaceId) {
      try {
        const leaveResult = await this.presenceService.handleLeave(
          userId,
          client.id,
          oldWorkspaceId,
        );

        if (leaveResult.isLastPresenceInWorkspace) {
          const lastSeenAt = new Date().toISOString();
          this.server
            .to(ROOMS.workspace(oldWorkspaceId))
            .emit(EVENTS.USER_PRESENCE, {
              userId,
              workspaceId: oldWorkspaceId,
              status: 'offline',
              lastSeenAt,
            });
        }
      } catch (err) {
        this.logger.error(
          `Failed to cleanup old workspace presence for user ${userId}`,
          err,
        );
      }
    }

    // Join new workspace presence
    const { isFirstPresenceInWorkspace } =
      await this.presenceService.handleJoin(userId, client.id, workspaceId);

    client.data.presenceWorkspaceId = workspaceId;

    // Broadcast online to workspace (exclude this socket)
    if (isFirstPresenceInWorkspace) {
      client.to(ROOMS.workspace(workspaceId)).emit(EVENTS.USER_PRESENCE, {
        userId,
        workspaceId,
        status: 'online',
        lastSeenAt: null,
      });
    }

    // Return snapshot of current online users to the joining client
    const onlineUserIds =
      await this.presenceService.getOnlineUsers(workspaceId);
    return { onlineUserIds };
  }

  @UseGuards(SocketAuthGuard)
  @SubscribeMessage(EVENTS.JOIN_CONVERSATION)
  async handleJoinConversation(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() conversationId: string,
  ): Promise<{ joined: true; roomId: string }> {
    await this.ensureConversationAccess(client, conversationId);
    const roomId = ROOMS.conversation(conversationId);
    await client.join(roomId);
    return { joined: true, roomId };
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
