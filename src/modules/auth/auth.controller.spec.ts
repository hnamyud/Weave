import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../common/guards/google-auth.guard', () => ({
  GoogleAuthGuard: class GoogleAuthGuard {},
}));

jest.mock('./auth.service', () => ({
  AuthService: class AuthService {},
}));

jest.mock('./password.service', () => ({
  PasswordService: class PasswordService {},
}));

import { IS_PUBLIC_KEY } from '../../common/decorators/customize.decorator';
import { CHECK_POLICIES_KEY } from '../../common/decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

function getMethodMetadata(metadataKey: string, methodName: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    AuthController.prototype,
    methodName,
  );

  return Reflect.getMetadata(metadataKey, descriptor?.value as object);
}

describe('AuthController password routes', () => {
  const authService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    logoutOtherDevices: jest.fn(),
    register: jest.fn(),
    processToken: jest.fn(),
    buildBrowserRedirectUrl: jest.fn(),
  };
  const passwordService = {
    verifyOtp: jest.fn<(email: string, otp: string) => Promise<boolean>>(),
    resetPassword: jest.fn<(dto: unknown) => Promise<void>>(),
    changePassword:
      jest.fn<(userId: string, dto: unknown) => Promise<unknown>>(),
    changeEmail: jest.fn<(userId: string, dto: unknown) => Promise<unknown>>(),
  };
  const configService = {};

  function createController() {
    jest.clearAllMocks();
    return new AuthController(
      authService as unknown as AuthService,
      passwordService as unknown as PasswordService,
      configService as never,
    );
  }

  it('marks verify OTP and reset password routes as public', () => {
    expect(getMethodMetadata(IS_PUBLIC_KEY, 'verifyOtp')).toBe(true);
    expect(getMethodMetadata(IS_PUBLIC_KEY, 'resetPassword')).toBe(true);
  });

  it('uses user update policy for authenticated password and email changes', () => {
    const changePasswordPolicy = getMethodMetadata(
      CHECK_POLICIES_KEY,
      'changePassword',
    ) as Array<{ action: Action }>;
    const changeEmailPolicy = getMethodMetadata(
      CHECK_POLICIES_KEY,
      'changeEmail',
    ) as Array<{ action: Action }>;

    expect(changePasswordPolicy).toHaveLength(1);
    expect(changePasswordPolicy[0].action).toBe(Action.Update);
    expect(changeEmailPolicy).toHaveLength(1);
    expect(changeEmailPolicy[0].action).toBe(Action.Update);
  });

  it('verifies OTP through password service', async () => {
    const controller = createController();
    passwordService.verifyOtp.mockResolvedValue(true);

    const result = await controller.verifyOtp({
      email: 'user@example.com',
      otp: '123456',
    });

    expect(passwordService.verifyOtp).toHaveBeenCalledWith(
      'user@example.com',
      '123456',
    );
    expect(result).toEqual({ verified: true });
  });

  it('resets password through password service', async () => {
    const controller = createController();
    const dto = {
      email: 'user@example.com',
      otp: '123456',
      newPassword: 'new-password',
    };

    const result = await controller.resetPassword(dto);

    expect(passwordService.resetPassword).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ reset: true });
  });

  it('changes password for authenticated user', async () => {
    const controller = createController();
    const dto = {
      oldPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    };
    passwordService.changePassword.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
    });

    const result = await controller.changePassword(
      { id: 'user-id', email: 'user@example.com' },
      dto,
    );

    expect(passwordService.changePassword).toHaveBeenCalledWith('user-id', dto);
    expect(result).toEqual({
      id: 'user-id',
      email: 'user@example.com',
    });
  });

  it('changes email for authenticated user', async () => {
    const controller = createController();
    const dto = {
      newEmail: 'new@example.com',
      otp: '123456',
    };
    passwordService.changeEmail.mockResolvedValue({
      id: 'user-id',
      email: 'new@example.com',
    });

    const result = await controller.changeEmail(
      { id: 'user-id', email: 'user@example.com' },
      dto,
    );

    expect(passwordService.changeEmail).toHaveBeenCalledWith('user-id', dto);
    expect(result).toEqual({
      id: 'user-id',
      email: 'new@example.com',
    });
  });
});
