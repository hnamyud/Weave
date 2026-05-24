import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

jest.mock('uuid', () => ({
  v7: () => 'new-token-id',
}));

import { TokensService } from './tokens.service';

describe('TokensService', () => {
  const prisma = {
    refreshToken: {
      findFirst: jest.fn<(args: any) => Promise<any>>(),
      findUnique: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
      updateMany: jest.fn<(args: any) => Promise<any>>(),
      deleteMany: jest.fn<(args: any) => Promise<any>>(),
      create: jest.fn<(args: any) => Promise<any>>(),
    },
    $transaction: jest.fn<(callback: (tx: any) => Promise<any>) => Promise<any>>(),
  };

  const jwtService = {
    sign: jest.fn<(payload: any, options?: any) => string>(),
    verify: jest.fn<(token: string, options?: any) => any>(),
  };

  const configService = {
    get: jest.fn<(key: string) => string | undefined>(),
  };

  let service: TokensService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    configService.get.mockImplementation((key) => {
      const values: Record<string, string> = {
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_ACCESS_EXPIRED: '15m',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_EXPIRED: '7d',
      };
      return values[key];
    });
    service = new TokensService(prisma as any, jwtService as any, configService as any);
    service.onModuleInit();
  });

  it('processes a valid refresh token by rotating it and returning a new session', async () => {
    jwtService.verify.mockReturnValue({
      id: 'user-id',
      email: 'user@example.com',
    });
    jwtService.sign
      .mockReturnValueOnce('new-refresh-token')
      .mockReturnValueOnce('new-access-token');
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'stored-token-id',
      userId: 'user-id',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      deviceInfo: {
        device: 'desktop',
      },
    });
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.processToken('old-refresh-token');

    expect(jwtService.verify).toHaveBeenCalledWith('old-refresh-token', {
      secret: 'refresh-secret',
    });
    expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: service.hashToken('old-refresh-token'),
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: {
        id: 'stored-token-id',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: 'user-id',
        email: 'user@example.com',
      },
    });
  });

  it('rejects refresh tokens that are not stored for the token owner', async () => {
    jwtService.verify.mockReturnValue({
      id: 'user-id',
      email: 'user@example.com',
    });
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'stored-token-id',
      userId: 'another-user-id',
    });

    await expect(service.processToken('refresh-token')).rejects.toThrow(BadRequestException);
  });

  it('deletes expired or revoked refresh token records', async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

    const result = await service.cleanupInactiveRefreshTokens();

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            expiresAt: {
              lt: expect.any(Date),
            },
          },
          {
            revokedAt: {
              not: null,
            },
          },
        ],
      },
    });
    expect(result).toEqual({ count: 3 });
  });

  it('revokes active refresh tokens for a user except the current token', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 4 });

    const currentTokenHash = service.hashToken('current-refresh-token');
    const result = await service.revokeOtherRefreshTokensForUser(
      'user-id',
      currentTokenHash,
    );

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        revokedAt: null,
        tokenHash: {
          not: currentTokenHash,
        },
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({ count: 4 });
  });
});
