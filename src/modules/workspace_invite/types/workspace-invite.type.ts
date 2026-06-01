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
  currentPage: number;
  limit: number;
  workspaceId: string;
  requesterId: string;
  type?: string;
  status?: string;
};
