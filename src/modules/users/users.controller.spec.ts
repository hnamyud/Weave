import { describe, expect, it, jest } from '@jest/globals';

jest.mock('./users.service', () => ({
  UsersService: class UsersService {},
}));

import { CHECK_POLICIES_KEY } from '../../common/decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { UsersController } from './users.controller';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

function getPolicyMetadata(methodName: keyof UsersController): unknown[] {
  return (Reflect.getMetadata(
    CHECK_POLICIES_KEY,
    UsersController.prototype[methodName],
  ) ?? []) as unknown[];
}

describe('UsersController', () => {
  const usersService = {
    getMyProfile: jest.fn<() => Promise<unknown>>(),
    getUserProfile: jest.fn<() => Promise<unknown>>(),
    updateMyProfile: jest.fn<() => Promise<unknown>>(),
    softDeleteUser: jest.fn<() => Promise<unknown>>(),
  };

  function createController() {
    jest.clearAllMocks();
    return new UsersController(usersService as unknown as UsersService);
  }

  it('uses user policies for all user profile routes', () => {
    const getMePolicy = getPolicyMetadata('getMyProfile') as Array<{
      action: Action;
    }>;
    const getUserPolicy = getPolicyMetadata('getUserProfile') as Array<{
      action: Action;
    }>;
    const updateMePolicy = getPolicyMetadata('updateMyProfile') as Array<{
      action: Action;
    }>;
    const deleteMePolicy = getPolicyMetadata('deleteMyAccount') as Array<{
      action: Action;
    }>;

    expect(getMePolicy[0].action).toBe(Action.Read);
    expect(getUserPolicy[0].action).toBe(Action.Read);
    expect(updateMePolicy[0].action).toBe(Action.Update);
    expect(deleteMePolicy[0].action).toBe(Action.Delete);
  });

  it('gets my profile using authenticated user id', async () => {
    const controller = createController();
    const user: UserInterface = {
      id: 'user-id',
      email: 'user@example.com',
    };

    await controller.getMyProfile(user);

    expect(usersService.getMyProfile).toHaveBeenCalledWith('user-id');
  });

  it('gets another user profile using route param id', async () => {
    const controller = createController();

    await controller.getUserProfile('target-user-id');

    expect(usersService.getUserProfile).toHaveBeenCalledWith('target-user-id');
  });

  it('updates my profile using authenticated user id', async () => {
    const controller = createController();
    const dto: UpdateUserDto = { displayName: 'New Name' };
    const user: UserInterface = {
      id: 'user-id',
      email: 'user@example.com',
    };

    await controller.updateMyProfile(user, dto);

    expect(usersService.updateMyProfile).toHaveBeenCalledWith(dto, 'user-id');
  });

  it('deletes my account using authenticated user id', async () => {
    const controller = createController();
    const user: UserInterface = {
      id: 'user-id',
      email: 'user@example.com',
    };

    await controller.deleteMyAccount(user);

    expect(usersService.softDeleteUser).toHaveBeenCalledWith('user-id');
  });
});
