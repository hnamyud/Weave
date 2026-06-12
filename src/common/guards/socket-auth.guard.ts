import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from 'prisma/prisma.service';
import { Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/interfaces/socket-events.interface';
import { SocketData } from '../../shared/interfaces/socket-data.interface';
import { InterServerEvents } from '../../shared/types/inter-server.type';

type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type JwtAccessPayload = {
  sub: string;
};


function normalizeToken(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const token = value.trim();
  return token.length > 0 ? token : null;
}

function extractBearerToken(authorization: unknown): string | null {
  const value = normalizeToken(authorization);

  if (!value || !value.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return normalizeToken(value.slice(7));
}

function getHandshakeToken(client: AuthenticatedSocket): string | null {
  const auth = client.handshake.auth as Record<string, unknown> | undefined;

  return (
    normalizeToken(auth?.token) ??
    extractBearerToken(client.handshake.headers.authorization)
  );
}

@Injectable()
export class SocketAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();

    const token = getHandshakeToken(client);
    if (!token) {
      throw new WsException('Missing auth token');
    }

    let payload: JwtAccessPayload;
    try {
      payload = this.jwt.verify<JwtAccessPayload>(token);
    } catch {
      throw new WsException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new WsException('User not found');
    }

    client.data.userId = user.id;

    return true;
  }
}
