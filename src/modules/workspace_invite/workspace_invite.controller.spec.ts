import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock(
  'prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

jest.mock('uuid', () => ({
  v7: () => 'invite-id',
}));

import { WorkspaceInviteController } from './workspace_invite.controller';
import {
  DirectInviteResponseDto,
  LinkInviteResponseDto,
} from './dto/invite-response.dto';
import { CreateDirectInviteDto, CreateInviteLinkDto } from './dto/invite.dto';
import { WorkspaceInviteService } from './workspace_invite.service';
import { UserInterface } from '../../shared/interfaces/users.interface';

describe('WorkspaceInviteController', () => {
  const workspaceInviteService = {
    createDirectInvite:
      jest.fn<
        (dto: CreateDirectInviteDto, createdById: string) => Promise<unknown>
      >(),
    createInviteLink:
      jest.fn<
        (dto: CreateInviteLinkDto, createdById: string) => Promise<unknown>
      >(),
    acceptDirectInvite:
      jest.fn<
        (
          dto: DirectInviteResponseDto,
          currentUser: UserInterface,
        ) => Promise<unknown>
      >(),
    acceptLinkInvite:
      jest.fn<
        (dto: LinkInviteResponseDto, currentUserId: string) => Promise<unknown>
      >(),
    denyInvite:
      jest.fn<
        (
          dto: DirectInviteResponseDto,
          currentUser: UserInterface,
        ) => Promise<unknown>
      >(),
    revokeInvite:
      jest.fn<(inviteId: string, currentUserId: string) => Promise<unknown>>(),
  };

  const controller = new WorkspaceInviteController(
    workspaceInviteService as unknown as WorkspaceInviteService,
  );
  const user: UserInterface = {
    id: 'current-user-id',
    email: 'current@example.com',
    username: null,
    displayName: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes workspaceId from route params when creating direct invites', async () => {
    workspaceInviteService.createDirectInvite.mockResolvedValue({
      id: 'invite-id',
    });

    await controller.inviteDirectly(
      'workspace-id',
      {
        invitedEmail: 'invited@example.com',
      },
      user,
    );

    expect(workspaceInviteService.createDirectInvite).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-id',
        invitedEmail: 'invited@example.com',
      },
      'current-user-id',
    );
  });

  it('passes workspaceId from route params when creating link invites', async () => {
    workspaceInviteService.createInviteLink.mockResolvedValue('invite-url');
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');

    await controller.inviteByLink(
      'workspace-id',
      {
        expiresAt,
      },
      user,
    );

    expect(workspaceInviteService.createInviteLink).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-id',
        expiresAt,
      },
      'current-user-id',
    );
  });

  it('passes accept direct dto and authenticated user to the service', async () => {
    workspaceInviteService.acceptDirectInvite.mockResolvedValue({
      id: 'response-id',
    });

    await controller.acceptDirectInvite(
      {
        token: 'direct-token',
      },
      user,
    );

    expect(workspaceInviteService.acceptDirectInvite).toHaveBeenCalledWith(
      {
        token: 'direct-token',
      },
      user,
    );
  });

  it('passes accept link dto and authenticated user id to the service', async () => {
    workspaceInviteService.acceptLinkInvite.mockResolvedValue({
      id: 'response-id',
    });

    await controller.acceptLinkInvite(
      {
        token: 'raw-token',
      },
      user,
    );

    expect(workspaceInviteService.acceptLinkInvite).toHaveBeenCalledWith(
      {
        token: 'raw-token',
      },
      'current-user-id',
    );
  });

  it('passes deny dto and authenticated user to the service', async () => {
    workspaceInviteService.denyInvite.mockResolvedValue({ id: 'response-id' });

    await controller.denyInvite(
      {
        token: 'direct-token',
      },
      user,
    );

    expect(workspaceInviteService.denyInvite).toHaveBeenCalledWith(
      {
        token: 'direct-token',
      },
      user,
    );
  });

  it('passes revoke invite id and authenticated user id to the service', async () => {
    workspaceInviteService.revokeInvite.mockResolvedValue({ id: 'invite-id' });

    await controller.revokeInvite('invite-id', user);

    expect(workspaceInviteService.revokeInvite).toHaveBeenCalledWith(
      'invite-id',
      'current-user-id',
    );
  });
});
