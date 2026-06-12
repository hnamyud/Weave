import { WsException } from '@nestjs/websockets';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EVENTS } from '../../shared/constants/socket-event.constant';
import { ROOMS } from '../../shared/constants/socket-room.constant';
import { RealtimeGateway, TypedSocket } from './realtime.gateway';

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
    get: jest.fn<(key: string) => string | undefined>(() => 'http://localhost:3000'),
  };

  let gateway: RealtimeGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new RealtimeGateway(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  it('joins workspace and user rooms for active workspace members', async () => {
    const { client, join } = createSocket();
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-id' });

    const ack = await gateway.handleJoinWorkspace(client, 'workspace-id');

    expect(client.data.workspaceId).toBe('workspace-id');
    expect(join).toHaveBeenCalledWith(ROOMS.workspace('workspace-id'));
    expect(join).toHaveBeenCalledWith(ROOMS.user('user-id'));
    expect(ack).toEqual({ joined: true, roomId: ROOMS.workspace('workspace-id') });
  });

  it('rejects workspace join for non-members', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(
      gateway.handleJoinWorkspace(createSocket().client, 'workspace-id'),
    ).rejects.toThrow(WsException);
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
    expect(ack).toEqual({ joined: true, roomId: ROOMS.conversation('conversation-id') });
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
});
