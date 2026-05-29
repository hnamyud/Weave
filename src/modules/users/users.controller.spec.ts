import { describe, expect, it, jest } from '@jest/globals';

jest.mock('./users.service', () => ({
  UsersService: class UsersService {},
}));

import { CHECK_POLICIES_KEY } from '../../common/decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  const usersService = {
    getMyProfile: jest.fn<() => Promise<any>>(),
    getUserProfile: jest.fn<() => Promise<any>>(),
    updateMyProfile: jest.fn<() => Promise<any>>(),
    softDeleteUser: jest.fn<() => Promise<any>>(),
  };

  function createController() {
    jest.clearAllMocks();
    return new UsersController(usersService as any);
  }

  it('uses user policies for all user profile routes', () => {
    const getMePolicy = Reflect.getMetadata(
      CHECK_POLICIES_KEY,
      UsersController.prototype.getMyProfile,
    );
    const getUserPolicy = Reflect.getMetadata(
      CHECK_POLICIES_KEY,
      UsersController.prototype.getUserProfile,
    );
    const updateMePolicy = Reflect.getMetadata(
      CHECK_POLICIES_KEY,
      UsersController.prototype.updateMyProfile,
    );
    const deleteMePolicy = Reflect.getMetadata(
      CHECK_POLICIES_KEY,
      UsersController.prototype.deleteMyAccount,
    );

    expect(getMePolicy[0].action).toBe(Action.Read);
    expect(getUserPolicy[0].action).toBe(Action.Read);
    expect(updateMePolicy[0].action).toBe(Action.Update);
    expect(deleteMePolicy[0].action).toBe(Action.Delete);
  });

  it('gets my profile using authenticated user id', async () => {
    const controller = createController();

    await controller.getMyProfile({ id: 'user-id' } as any);

    expect(usersService.getMyProfile).toHaveBeenCalledWith('user-id');
  });

  it('gets another user profile using route param id', async () => {
    const controller = createController();

    await controller.getUserProfile('target-user-id');

    expect(usersService.getUserProfile).toHaveBeenCalledWith('target-user-id');
  });

  it('updates my profile using authenticated user id', async () => {
    const controller = createController();
    const dto = { displayName: 'New Name' } as any;

    await controller.updateMyProfile({ id: 'user-id' } as any, dto);

    expect(usersService.updateMyProfile).toHaveBeenCalledWith(dto, 'user-id');
  });

  it('deletes my account using authenticated user id', async () => {
    const controller = createController();

    await controller.deleteMyAccount({ id: 'user-id' } as any);

    expect(usersService.softDeleteUser).toHaveBeenCalledWith('user-id');
  });
});
