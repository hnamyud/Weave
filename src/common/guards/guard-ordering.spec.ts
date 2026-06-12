/**
 * Guard ordering integration test.
 *
 * Verifies that PoliciesGuard correctly receives workspace/conversation member
 * context populated by the resource guards (WorkspaceMemberGuard /
 * ConversationMemberGuard) when those guards are chained at route level BEFORE
 * PoliciesGuard.
 *
 * Before the fix, PoliciesGuard was registered as a global guard and therefore
 * executed BEFORE the route-level resource guards, meaning
 * request.workspaceMember was always undefined when CASL built the ability.
 * This caused every @RequireWorkspacePermission / @RequireConversationPermission
 * endpoint to return 403 for valid members.
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({ PrismaService: class PrismaService {} }),
  { virtual: true },
);

import { CaslAbilityFactory } from '../casl/ability.factory';
import { PoliciesGuard } from './policy.guard';
import { WorkspaceMemberGuard } from './workspace-member.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { CHECK_POLICIES_KEY } from '../decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';
import { WorkspaceRole } from '../../shared/enums/workspace-role.enum';

function makeContext(request: unknown): ExecutionContext {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
  } as ExecutionContext;
}

describe('Guard ordering: WorkspaceMemberGuard → PoliciesGuard', () => {
  const prisma = {
    workspaceMember: {
      findFirst: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
    workspaceInvite: {
      findUnique: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
    conversation: {
      findFirst: jest.fn<(args: unknown) => Promise<unknown>>(),
    },
  };

  const reflector = {
    getAllAndOverride: jest.fn<(...args: unknown[]) => unknown>(),
    get: jest.fn<(...args: unknown[]) => unknown>(),
  };

  const caslFactory = new CaslAbilityFactory();

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false); // not public
  });

  it('OWNER passes Read Workspace check when WorkspaceMemberGuard runs first', async () => {
    const member = {
      id: 'member-id',
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: WorkspaceRole.Owner,
      workspace: { id: 'ws-1', isDeleted: false },
    };
    prisma.workspaceMember.findFirst.mockResolvedValue(member);

    const request: Record<string, unknown> = {
      user: { id: 'user-1', email: 'owner@test.com' },
      params: { id: 'ws-1' },
      body: {},
    };

    const ctx = makeContext(request);

    // Step 1: resource guard populates request.workspaceMember
    const wmGuard = new WorkspaceMemberGuard(
      prisma as unknown as PrismaService,
    );
    await wmGuard.canActivate(ctx);
    expect(request.workspaceMember).toBeDefined();

    // Step 2: PoliciesGuard reads request.workspaceMember for CASL
    reflector.get.mockImplementation((key: unknown) => {
      if (key === CHECK_POLICIES_KEY) {
        return [
          {
            action: Action.Read,
            message: 'no read',
            handle: (
              ability: ReturnType<CaslAbilityFactory['createForUser']>,
            ) => ability.can(Action.Read, 'Workspace'),
          },
        ];
      }
      return undefined;
    });

    const policiesGuard = new PoliciesGuard(
      reflector as unknown as Reflector,
      caslFactory,
    );
    await expect(policiesGuard.canActivate(ctx)).resolves.toBe(true);
  });

  it('MEMBER passes Read Workspace check when WorkspaceMemberGuard runs first', async () => {
    const member = {
      id: 'member-id',
      workspaceId: 'ws-1',
      userId: 'user-2',
      role: WorkspaceRole.Member,
      workspace: { id: 'ws-1', isDeleted: false },
    };
    prisma.workspaceMember.findFirst.mockResolvedValue(member);

    const request: Record<string, unknown> = {
      user: { id: 'user-2', email: 'member@test.com' },
      params: { id: 'ws-1' },
      body: {},
    };
    const ctx = makeContext(request);

    const wmGuard = new WorkspaceMemberGuard(
      prisma as unknown as PrismaService,
    );
    await wmGuard.canActivate(ctx);

    reflector.get.mockImplementation((key: unknown) => {
      if (key === CHECK_POLICIES_KEY) {
        return [
          {
            action: Action.Read,
            message: 'no read',
            handle: (
              ability: ReturnType<CaslAbilityFactory['createForUser']>,
            ) => ability.can(Action.Read, 'Workspace'),
          },
        ];
      }
      return undefined;
    });

    const policiesGuard = new PoliciesGuard(
      reflector as unknown as Reflector,
      caslFactory,
    );
    await expect(policiesGuard.canActivate(ctx)).resolves.toBe(true);
  });

  it('GUEST is denied Read WorkspaceInvite when WorkspaceMemberGuard runs first', async () => {
    const member = {
      id: 'member-id',
      workspaceId: 'ws-1',
      userId: 'user-3',
      role: WorkspaceRole.Guest,
      workspace: { id: 'ws-1', isDeleted: false },
    };
    prisma.workspaceMember.findFirst.mockResolvedValue(member);

    const request: Record<string, unknown> = {
      user: { id: 'user-3', email: 'guest@test.com' },
      params: { workspaceId: 'ws-1' },
      body: {},
    };
    const ctx = makeContext(request);

    const wmGuard = new WorkspaceMemberGuard(
      prisma as unknown as PrismaService,
    );
    await wmGuard.canActivate(ctx);

    reflector.get.mockImplementation((key: unknown) => {
      if (key === CHECK_POLICIES_KEY) {
        return [
          {
            action: Action.Read,
            message: 'no invite read',
            handle: (
              ability: ReturnType<CaslAbilityFactory['createForUser']>,
            ) => ability.can(Action.Read, 'WorkspaceInvite'),
          },
        ];
      }
      return undefined;
    });

    const policiesGuard = new PoliciesGuard(
      reflector as unknown as Reflector,
      caslFactory,
    );
    await expect(policiesGuard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('FAILS when PoliciesGuard runs BEFORE WorkspaceMemberGuard (demonstrates the original bug)', async () => {
    // This test documents the original broken behavior:
    // when request.workspaceMember is undefined (i.e., global guard ordering),
    // CASL builds ability with no workspace role, so Read Workspace returns false.
    const request: Record<string, unknown> = {
      user: { id: 'user-1', email: 'owner@test.com' },
      params: { id: 'ws-1' },
      body: {},
      // workspaceMember is NOT set — simulates global guard running before resource guard
    };
    const ctx = makeContext(request);

    reflector.get.mockImplementation((key: unknown) => {
      if (key === CHECK_POLICIES_KEY) {
        return [
          {
            action: Action.Read,
            message: 'no read',
            handle: (
              ability: ReturnType<CaslAbilityFactory['createForUser']>,
            ) => ability.can(Action.Read, 'Workspace'),
          },
        ];
      }
      return undefined;
    });

    const policiesGuard = new PoliciesGuard(
      reflector as unknown as Reflector,
      caslFactory,
    );
    // Without workspaceMember context, even an owner gets 403
    await expect(policiesGuard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
