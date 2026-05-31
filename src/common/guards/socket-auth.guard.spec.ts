import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Socket } from 'socket.io';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/interfaces/socket-events.interface';
import { SocketData } from '../../shared/interfaces/socket-data.interface';
import { InterServerEvents } from '../../shared/types/inter-server.type';
import { SocketAuthGuard } from './socket-auth.guard';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

type TestSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function createContext(client: TestSocket): ExecutionContext {
  return {
    switchToWs: () => ({
      getClient: <TClient>() => client as TClient,
    }),
  } as ExecutionContext;
}

function createSocket(input: {
  authToken?: string;
  authorization?: string;
  queryToken?: string;
}): TestSocket {
  return {
    data: {},
    handshake: {
      auth: input.authToken ? { token: input.authToken } : {},
      headers: input.authorization
        ? { authorization: input.authorization }
        : {},
      query: input.queryToken ? { token: input.queryToken } : {},
    },
  } as unknown as TestSocket;
}

describe('SocketAuthGuard', () => {
  const jwtService = {
    verify: jest.fn<(token: string) => { sub: string }>(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn<(args: unknown) => Promise<{ id: string } | null>>(),
    },
  };

  let guard: SocketAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.verify.mockReturnValue({ sub: 'user-id' });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id' });
    guard = new SocketAuthGuard(
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
    );
  });

  it('accepts token from handshake auth and attaches user id', async () => {
    const client = createSocket({ authToken: 'access-token' });

    await expect(guard.canActivate(createContext(client))).resolves.toBe(true);

    expect(jwtService.verify).toHaveBeenCalledWith('access-token');
    expect(client.data.userId).toBe('user-id');
  });

  it('accepts bearer authorization header', async () => {
    const client = createSocket({ authorization: 'Bearer header-token' });

    await expect(guard.canActivate(createContext(client))).resolves.toBe(true);

    expect(jwtService.verify).toHaveBeenCalledWith('header-token');
  });

  it('rejects missing tokens', async () => {
    await expect(
      guard.canActivate(createContext(createSocket({}))),
    ).rejects.toThrow(WsException);
  });

  it('rejects invalid tokens', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(
      guard.canActivate(createContext(createSocket({ authToken: 'bad' }))),
    ).rejects.toThrow(WsException);
  });

  it('rejects missing or soft-deleted users', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext(createSocket({ authToken: 'token' }))),
    ).rejects.toThrow(WsException);
  });
});
