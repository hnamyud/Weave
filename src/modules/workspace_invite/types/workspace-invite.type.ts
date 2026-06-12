import type {
  CreateDirectInviteDto,
  CreateInviteLinkDto,
} from '../dto/invite.dto';

export type CreateInviteLinkInput = CreateInviteLinkDto & {
  workspaceId: string;
};

export type CreateDirectInviteInput = CreateDirectInviteDto & {
  workspaceId: string;
};

export type InviteListStatus = 'ACTIVE';

export type GetWorkspaceInvitesInput = {
  currentPage: string | undefined;
  limit: string | undefined;
  workspaceId: string;
  requesterId: string;
  type?: string;
  status?: string;
};
