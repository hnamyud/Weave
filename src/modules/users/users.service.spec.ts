import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('uuid', () => ({
  v7: () => 'user-id',
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  genSaltSync: jest.fn(() => 'salt'),
  hashSync: jest.fn(() => 'hashed-password'),
}));

import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';

function prismaError(code: string, target?: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: 'test',
    meta: target ? { target } : undefined,
  });
}

describe('UsersService', () => {
  const prisma = {
    user: {
      create: jest.fn<(args: any) => Promise<any>>(),
      update: jest.fn<(args: any) => Promise<any>>(),
      findUnique: jest.fn<(args: any) => Promise<any>>(),
    },
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('maps register email unique constraint to a bad request without pre-querying user email', async () => {
    prisma.user.create.mockRejectedValue(prismaError('P2002', ['email']));

    await expect(
      service.registerUser({
        username: 'tester',
        email: 'tester@example.com',
        password: 'password123',
        displayName: 'Tester',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('maps register username unique constraint to a bad request', async () => {
    prisma.user.create.mockRejectedValue(prismaError('P2002', ['username']));

    await expect(
      service.registerUser({
        username: 'tester',
        email: 'tester@example.com',
        password: 'password123',
        displayName: 'Tester',
      }),
    ).rejects.toThrow('Username: tester is already existed');
  });

  it('maps update username unique constraints to bad requests', async () => {
    prisma.user.update.mockRejectedValueOnce(
      prismaError('P2002', ['username']),
    );

    await expect(
      service.updateMyProfile(
        {
          username: 'tester',
        } as UpdateUserDto,
        'user-id',
      ),
    ).rejects.toThrow('Username: tester is already existed');
  });

  it('does not update email through profile updates', async () => {
    prisma.user.update.mockResolvedValue({ id: 'user-id' });

    await service.updateMyProfile(
      {
        email: 'tester@example.com',
        displayName: 'Tester',
      } as UpdateUserDto & { email: string },
      'user-id',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
        deletedAt: null,
      },
      data: expect.not.objectContaining({
        email: expect.any(String),
      }),
    });
  });

  it('maps update missing user to a bad request', async () => {
    prisma.user.update.mockRejectedValue(prismaError('P2025'));

    await expect(
      service.updateMyProfile(
        {
          username: 'tester',
        } as UpdateUserDto,
        'user-id',
      ),
    ).rejects.toThrow('User: user-id does not exist');
  });
});
