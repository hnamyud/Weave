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
    resetPassword: jest.fn<(dto: any) => Promise<void>>(),
    changePassword: jest.fn<(userId: string, dto: any) => Promise<any>>(),
    changeEmail: jest.fn<(userId: string, dto: any) => Promise<any>>(),
  };
  const configService = {};

  function createController() {
    jest.clearAllMocks();
    return new AuthController(authService as any, passwordService as any, configService as any);
  }

  it('marks verify OTP and reset password routes as public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.verifyOtp)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.resetPassword)).toBe(true);
  });

  it('uses user update policy for authenticated password and email changes', () => {
    const changePasswordPolicy = Reflect.getMetadata(CHECK_POLICIES_KEY, AuthController.prototype.changePassword);
    const changeEmailPolicy = Reflect.getMetadata(CHECK_POLICIES_KEY, AuthController.prototype.changeEmail);

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

    expect(passwordService.verifyOtp).toHaveBeenCalledWith('user@example.com', '123456');
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

    const result = await controller.changePassword({ id: 'user-id' } as any, dto);

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

    const result = await controller.changeEmail({ id: 'user-id' } as any, dto);

    expect(passwordService.changeEmail).toHaveBeenCalledWith('user-id', dto);
    expect(result).toEqual({
      id: 'user-id',
      email: 'new@example.com',
    });
  });
});
