import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const redisClient = {
    get: jest.fn<(key: string) => Promise<string | null>>(),
    del: jest.fn<(...keys: string[]) => Promise<number>>(),
    incr: jest.fn<(key: string) => Promise<number>>(),
    expire: jest.fn<(key: string, seconds: number) => Promise<number>>(),
  };

  const userService = {
    findOneById: jest.fn<(id: string) => Promise<any>>(),
    isValidPassword: jest.fn<(password: string, hash: string) => Promise<boolean>>(),
    updateUserPasswordById: jest.fn<(id: string, newPassword: string) => Promise<void>>(),
    updateUserEmail: jest.fn<(id: string, newEmail: string) => Promise<any>>(),
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

  it('changes email after verifying OTP from the change-email Redis namespace', async () => {
    userService.findOneById.mockResolvedValue({
      id: 'user-id',
      email: 'old@example.com',
    });
    redisClient.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('123456');
    userService.updateUserEmail.mockResolvedValue({
      id: 'user-id',
      email: 'new@example.com',
    });
    redisClient.del.mockResolvedValue(1);

    const result = await service.changeEmail('user-id', {
      newEmail: ' New@Example.com ',
      otp: '123456',
    });

    expect(redisClient.get).toHaveBeenNthCalledWith(
      1,
      'change_email_otp_attempts:user-id:new@example.com',
    );
    expect(redisClient.get).toHaveBeenNthCalledWith(
      2,
      'change_email_otp:user-id:new@example.com',
    );
    expect(userService.updateUserEmail).toHaveBeenCalledWith(
      'user-id',
      'new@example.com',
    );
    expect(redisClient.del).toHaveBeenCalledWith('change_email_otp_attempts:user-id:new@example.com');
    expect(redisClient.del).toHaveBeenCalledWith('change_email_otp:user-id:new@example.com');
    expect(result).toEqual({
      id: 'user-id',
      email: 'new@example.com',
    });
  });

  it('rejects changing email to the current email before verifying OTP', async () => {
    userService.findOneById.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
    });

    await expect(
      service.changeEmail('user-id', {
        newEmail: 'user@example.com',
        otp: '123456',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(redisClient.get).not.toHaveBeenCalled();
    expect(userService.updateUserEmail).not.toHaveBeenCalled();
  });

  it('rejects changing email when OTP is invalid', async () => {
    userService.findOneById.mockResolvedValue({
      id: 'user-id',
      email: 'old@example.com',
    });
    redisClient.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('123456');
    redisClient.incr.mockResolvedValue(1);
    redisClient.expire.mockResolvedValue(1);

    await expect(
      service.changeEmail('user-id', {
        newEmail: 'new@example.com',
        otp: '000000',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(redisClient.incr).toHaveBeenCalledWith('change_email_otp_attempts:user-id:new@example.com');
    expect(redisClient.expire).toHaveBeenCalledWith('change_email_otp_attempts:user-id:new@example.com', 300);
    expect(userService.updateUserEmail).not.toHaveBeenCalled();
  });
});
