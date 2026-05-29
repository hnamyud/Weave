import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
} from '../decorators/policy.decorator';
import { PoliciesGuard } from './policy.guard';

describe('PoliciesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn<(key: string, targets: unknown[]) => boolean>(),
    get: jest.fn<
      (key: string, target: unknown) => PolicyHandler[] | undefined
    >(),
  };
  const caslAbilityFactory = {
    createForUser: jest.fn<(user: unknown) => unknown>(),
  };

  const createContext = (request: unknown): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({
        getRequest: <TRequest>() => request as TRequest,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    caslAbilityFactory.createForUser.mockReturnValue({ ability: true });
  });

  it('passes when route has no policy handlers', async () => {
    const guard = new PoliciesGuard(
      reflector as unknown as Reflector,
      caslAbilityFactory,
    );
    reflector.get.mockReturnValue(undefined);

    await expect(
      guard.canActivate(createContext({ user: { id: 'user-id' } })),
    ).resolves.toBe(true);
  });

  it('passes request to functional policy handlers', async () => {
    const guard = new PoliciesGuard(
      reflector as unknown as Reflector,
      caslAbilityFactory,
    );
    const request = { user: { id: 'user-id' }, workspaceId: 'workspace-id' };
    const handler = jest.fn().mockReturnValue(true);
    reflector.get.mockImplementation((key: string) => {
      if (key === CHECK_POLICIES_KEY) {
        return [handler];
      }
      return undefined;
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(handler).toHaveBeenCalledWith({ ability: true }, request);
  });

  it('throws configured message when policy is denied', async () => {
    const guard = new PoliciesGuard(
      reflector as unknown as Reflector,
      caslAbilityFactory,
    );
    reflector.get.mockReturnValue([
      {
        message: 'Denied by policy',
        handle: () => false,
      },
    ]);

    await expect(
      guard.canActivate(createContext({ user: { id: 'user-id' } })),
    ).rejects.toThrow(new ForbiddenException('Denied by policy'));
  });
});
