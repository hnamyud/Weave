import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const redisClient = {
    get: jest.fn<() => Promise<string | null>>(),
    del: jest.fn<() => Promise<number>>(),
    incr: jest.fn<() => Promise<number>>(),
    expire: jest.fn<() => Promise<number>>(),
  };

  const userService = {
    findOneById: jest.fn<(id: string) => Promise<any>>(),
    isValidPassword: jest.fn<(password: string, hash: string) => Promise<boolean>>(),
    updateUserPasswordById: jest.fn<(id: string, newPassword: string) => Promise<void>>(),
  };

  let service: PasswordService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PasswordService(userService as any, redisClient as any);
  });

  it('changes password after validating confirmation, old password, and password reuse', async () => {
    userService.findOneById.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      password: 'old-password-hash',
    });
    userService.isValidPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    userService.updateUserPasswordById.mockResolvedValue(undefined);

    const result = await service.changePassword('user-id', {
      oldPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });

    expect(userService.findOneById).toHaveBeenCalledWith('user-id');
    expect(userService.isValidPassword).toHaveBeenNthCalledWith(
      1,
      'old-password',
      'old-password-hash',
    );
    expect(userService.isValidPassword).toHaveBeenNthCalledWith(
      2,
      'new-password',
      'old-password-hash',
    );
    expect(userService.updateUserPasswordById).toHaveBeenCalledWith(
      'user-id',
      'new-password',
    );
    expect(result).toEqual({
      id: 'user-id',
      email: 'user@example.com',
    });
  });

  it('rejects password confirmation mismatch before loading the user', async () => {
    await expect(
      service.changePassword('user-id', {
        oldPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'different-password',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userService.findOneById).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    userService.findOneById.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      password: 'old-password-hash',
    });
    userService.isValidPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      service.changePassword('user-id', {
        oldPassword: 'old-password',
        newPassword: 'old-password',
        confirmPassword: 'old-password',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(userService.updateUserPasswordById).not.toHaveBeenCalled();
  });
});
