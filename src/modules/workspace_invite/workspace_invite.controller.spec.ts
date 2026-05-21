import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}), { virtual: true });

jest.mock('uuid', () => ({
  v7: () => 'invite-id',
}));

import { WorkspaceInviteController } from './workspace_invite.controller';

describe('WorkspaceInviteController', () => {
  const workspaceInviteService = {
    createDirectInvite: jest.fn<(dto: any, createdById: string) => Promise<any>>(),
    createInviteLink: jest.fn<(dto: any, createdById: string) => Promise<any>>(),
    acceptDirectInvite: jest.fn<(dto: any, currentUserId: string) => Promise<any>>(),
    acceptLinkInvite: jest.fn<(dto: any, currentUserId: string) => Promise<any>>(),
    denyInvite: jest.fn<(dto: any, currentUserId: string) => Promise<any>>(),
    revokeInvite: jest.fn<(inviteId: string, currentUserId: string) => Promise<any>>(),
  };

  const controller = new WorkspaceInviteController(workspaceInviteService as any);
  const user = { id: 'current-user-id' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes workspaceId from route params when creating direct invites', async () => {
    workspaceInviteService.createDirectInvite.mockResolvedValue({ id: 'invite-id' });

    await controller.inviteDirectly('workspace-id', {
      invitedUserId: 'invited-user-id',
    }, user);

    expect(workspaceInviteService.createDirectInvite).toHaveBeenCalledWith({
      workspaceId: 'workspace-id',
      invitedUserId: 'invited-user-id',
    }, 'current-user-id');
  });

  it('passes workspaceId from route params when creating link invites', async () => {
    workspaceInviteService.createInviteLink.mockResolvedValue('invite-url');
    const expiresAt = new Date('2026-06-01T00:00:00.000Z');

    await controller.inviteByLink('workspace-id', {
      expiresAt,
    }, user);

    expect(workspaceInviteService.createInviteLink).toHaveBeenCalledWith({
      workspaceId: 'workspace-id',
      expiresAt,
    }, 'current-user-id');
  });

  it('passes accept direct dto and authenticated user id to the service', async () => {
    workspaceInviteService.acceptDirectInvite.mockResolvedValue({ id: 'response-id' });

    await controller.acceptDirectInvite({
      inviteId: 'direct-invite-id',
    }, user);

    expect(workspaceInviteService.acceptDirectInvite).toHaveBeenCalledWith({
      inviteId: 'direct-invite-id',
    }, 'current-user-id');
  });

  it('passes accept link dto and authenticated user id to the service', async () => {
    workspaceInviteService.acceptLinkInvite.mockResolvedValue({ id: 'response-id' });

    await controller.acceptLinkInvite({
      token: 'raw-token',
    }, user);

    expect(workspaceInviteService.acceptLinkInvite).toHaveBeenCalledWith({
      token: 'raw-token',
    }, 'current-user-id');
  });

  it('passes deny dto and authenticated user id to the service', async () => {
    workspaceInviteService.denyInvite.mockResolvedValue({ id: 'response-id' });

    await controller.denyInvite({
      inviteId: 'direct-invite-id',
    }, user);

    expect(workspaceInviteService.denyInvite).toHaveBeenCalledWith({
      inviteId: 'direct-invite-id',
    }, 'current-user-id');
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
