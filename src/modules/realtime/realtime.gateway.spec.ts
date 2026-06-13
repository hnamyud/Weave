import { WsException } from '@nestjs/websockets';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { EVENTS } from '../../shared/constants/socket-event.constant';
import { ROOMS } from '../../shared/constants/socket-room.constant';
import { RealtimeGateway, TypedSocket } from './realtime.gateway';
import { PresenceLastSeenJobData } from './presence.processor';
import { PresenceService } from './presence.service';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

type SocketFixture = {
  client: TypedSocket;
  join: jest.Mock<(room: string) => Promise<void>>;
  leave: jest.Mock<(room: string) => Promise<void>>;
  to: jest.Mock<
    (room: string) => { emit: (event: string, payload: unknown) => void }
  >;
};

function createSocket(): SocketFixture {
  const join = jest.fn<(room: string) => Promise<void>>().mockResolvedValue();
  const leave = jest.fn<(room: string) => Promise<void>>().mockResolvedValue();
  const to =
    jest.fn<
      (room: string) => { emit: (event: string, payload: unknown) => void }
    >();
  const client = {
    id: 'socket-id',
    data: {
      userId: 'user-id',
    },
    join,
    leave,
    to,
  } as unknown as TypedSocket;

  return { client, join, leave, to };
}

describe('RealtimeGateway', () => {
  const prisma = {
    workspaceMember: {
      findFirst: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
    conversationMember: {
      findFirst: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
  };

  const configService = {
    get: jest.fn<(key: string) => string | undefined>(
      () => 'http://localhost:3000',
    ),
  };
  const presenceService = {
    handleJoin:
      jest.fn<
        (
          userId: string,
          socketId: string,
          workspaceId: string,
        ) => Promise<{ isFirstPresenceInWorkspace: boolean }>
      >(),
    handleLeave:
      jest.fn<
        (
          userId: string,
          socketId: string,
          workspaceId: string,
        ) => Promise<{ isLastPresenceInWorkspace: boolean }>
      >(),
    handleDisconnect: jest.fn<
      (socketId: string) => Promise<{
        userId: string;
        workspaceId: string;
        isLastPresenceInWorkspace: boolean;
      } | null>
    >(),
    getOnlineUsers: jest.fn<(workspaceId: string) => Promise<string[]>>(),
  };
  const presenceLastSeenQueue = {
    add: jest.fn<
      (name: string, data: PresenceLastSeenJobData) => Promise<void>
    >(),
  };
  const serverEmit = jest.fn<(event: string, payload: unknown) => void>();
  const serverTo = jest.fn<(room: string) => { emit: typeof serverEmit }>(
    () => ({ emit: serverEmit }),
  );

  let gateway: RealtimeGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    presenceService.handleJoin.mockResolvedValue({
      isFirstPresenceInWorkspace: true,
    });
    presenceService.handleLeave.mockResolvedValue({
      isLastPresenceInWorkspace: true,
    });
    presenceService.handleDisconnect.mockResolvedValue(null);
    presenceService.getOnlineUsers.mockResolvedValue(['user-id']);
    presenceLastSeenQueue.add.mockResolvedValue();
    gateway = new RealtimeGateway(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      presenceService as unknown as PresenceService,
      presenceLastSeenQueue as unknown as Queue<PresenceLastSeenJobData>,
    );
    gateway.server = {
      to: serverTo,
    } as unknown as RealtimeGateway['server'];
  });

  it('joins workspace and user rooms for active workspace members', async () => {
    const { client, join } = createSocket();
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });

    const ack = await gateway.handleJoinWorkspace(client, 'workspace-id');

    expect(client.data.workspaceId).toBe('workspace-id');
    expect(join).toHaveBeenCalledWith(ROOMS.workspace('workspace-id'));
    expect(join).toHaveBeenCalledWith(ROOMS.user('user-id'));
    expect(ack).toEqual({
      joined: true,
      roomId: ROOMS.workspace('workspace-id'),
    });
  });

  it('rejects workspace join for non-members', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(
      gateway.handleJoinWorkspace(createSocket().client, 'workspace-id'),
    ).rejects.toThrow(WsException);
  });

  it('rejects presence join for non-members', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(
      gateway.handlePresenceJoin(createSocket().client, {
        workspaceId: 'workspace-id',
      }),
    ).rejects.toThrow(WsException);
  });

  it('joins presence and returns an online users snapshot', async () => {
    const { client } = createSocket();
    const emit = jest.fn<(event: string, payload: unknown) => void>();
    const to = jest.fn<(room: string) => { emit: typeof emit }>(() => ({
      emit,
    }));
    client.to = to as unknown as TypedSocket['to'];
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    presenceService.getOnlineUsers.mockResolvedValue(['user-id', 'peer-id']);

    const ack = await gateway.handlePresenceJoin(client, {
      workspaceId: 'workspace-id',
    });

    expect(presenceService.handleJoin).toHaveBeenCalledWith(
      'user-id',
      'socket-id',
      'workspace-id',
    );
    expect(client.data.presenceWorkspaceId).toBe('workspace-id');
    expect(to).toHaveBeenCalledWith(ROOMS.workspace('workspace-id'));
    expect(emit).toHaveBeenCalledWith(EVENTS.USER_PRESENCE, {
      userId: 'user-id',
      workspaceId: 'workspace-id',
      status: 'online',
      lastSeenAt: null,
    });
    expect(ack).toEqual({ onlineUserIds: ['user-id', 'peer-id'] });
  });

  it('does not broadcast duplicate online presence for a second socket', async () => {
    const { client } = createSocket();
    const emit = jest.fn<(event: string, payload: unknown) => void>();
    const to = jest.fn<(room: string) => { emit: typeof emit }>(() => ({
      emit,
    }));
    client.to = to as unknown as TypedSocket['to'];
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });
    presenceService.handleJoin.mockResolvedValue({
      isFirstPresenceInWorkspace: false,
    });

    await gateway.handlePresenceJoin(client, { workspaceId: 'workspace-id' });

    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('broadcasts offline to the old workspace when switching presence workspaces', async () => {
    const { client } = createSocket();
    const emit = jest.fn<(event: string, payload: unknown) => void>();
    const to = jest.fn<(room: string) => { emit: typeof emit }>(() => ({
      emit,
    }));
    client.to = to as unknown as TypedSocket['to'];
    client.data.presenceWorkspaceId = 'old-workspace-id';
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });

    await gateway.handlePresenceJoin(client, {
      workspaceId: 'new-workspace-id',
    });

    expect(presenceService.handleLeave).toHaveBeenCalledWith(
      'user-id',
      'socket-id',
      'old-workspace-id',
    );
    expect(serverTo).toHaveBeenCalledWith(ROOMS.workspace('old-workspace-id'));
    expect(serverEmit).toHaveBeenCalledWith(
      EVENTS.USER_PRESENCE,
      expect.objectContaining({
        userId: 'user-id',
        workspaceId: 'old-workspace-id',
        status: 'offline',
      }),
    );
    expect(client.data.presenceWorkspaceId).toBe('new-workspace-id');
  });

  it('joins conversation rooms after workspace join and membership check', async () => {
    const { client, join } = createSocket();
    client.data.workspaceId = 'workspace-id';
    prisma.conversationMember.findFirst.mockResolvedValue({
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
      },
      user: {
        displayName: 'Alice',
      },
    });

    const ack = await gateway.handleJoinConversation(client, 'conversation-id');

    expect(join).toHaveBeenCalledWith(ROOMS.conversation('conversation-id'));
    expect(ack).toEqual({
      joined: true,
      roomId: ROOMS.conversation('conversation-id'),
    });
  });

  it('rejects conversation join before workspace join or without membership', async () => {
    await expect(
      gateway.handleJoinConversation(createSocket().client, 'conversation-id'),
    ).rejects.toThrow(WsException);

    const { client } = createSocket();
    client.data.workspaceId = 'workspace-id';
    prisma.conversationMember.findFirst.mockResolvedValue(null);

    await expect(
      gateway.handleJoinConversation(client, 'conversation-id'),
    ).rejects.toThrow(WsException);
  });

  it('broadcasts typing events to the conversation room except sender', async () => {
    const { client } = createSocket();
    const emit = jest.fn<(event: string, payload: unknown) => void>();
    const to = jest.fn<(room: string | string[]) => { emit: typeof emit }>(
      () => ({ emit }),
    );
    client.data.workspaceId = 'workspace-id';
    client.to = to as unknown as TypedSocket['to'];
    prisma.conversationMember.findFirst.mockResolvedValue({
      conversation: {
        id: 'conversation-id',
        workspaceId: 'workspace-id',
      },
      user: {
        displayName: 'Alice',
      },
    });

    await gateway.handleTypingStart(client, 'conversation-id');

    expect(to).toHaveBeenCalledWith(ROOMS.conversation('conversation-id'));
    expect(emit).toHaveBeenCalledWith(EVENTS.TYPING, {
      conversationId: 'conversation-id',
      userId: 'user-id',
      displayName: 'Alice',
    });
  });

  it('broadcasts offline and enqueues lastSeenAt when the final presence socket disconnects', async () => {
    const { client } = createSocket();
    client.data.presenceWorkspaceId = 'workspace-id';
    presenceService.handleDisconnect.mockResolvedValue({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      isLastPresenceInWorkspace: true,
    });

    await gateway.handleDisconnect(client);

    expect(presenceService.handleDisconnect).toHaveBeenCalledWith('socket-id');
    expect(serverTo).toHaveBeenCalledWith(ROOMS.workspace('workspace-id'));
    expect(serverEmit).toHaveBeenCalledWith(
      EVENTS.USER_PRESENCE,
      expect.objectContaining({
        userId: 'user-id',
        workspaceId: 'workspace-id',
        status: 'offline',
      }),
    );
    expect(presenceLastSeenQueue.add).toHaveBeenCalledWith(
      'persist',
      expect.objectContaining({
        userId: 'user-id',
      }),
    );
  });

  it('does not broadcast offline or enqueue lastSeenAt while another presence socket remains', async () => {
    const { client } = createSocket();
    client.data.presenceWorkspaceId = 'workspace-id';
    presenceService.handleDisconnect.mockResolvedValue({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      isLastPresenceInWorkspace: false,
    });

    await gateway.handleDisconnect(client);

    expect(serverTo).not.toHaveBeenCalled();
    expect(serverEmit).not.toHaveBeenCalled();
    expect(presenceLastSeenQueue.add).not.toHaveBeenCalled();
  });
});
