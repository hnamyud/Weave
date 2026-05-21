import { Body, Controller, Param, Post, Patch } from '@nestjs/common';
import { WorkspaceInviteService } from './workspace_invite.service';
import { GetUser, ResponseMessage } from '../../common/decorators/customize.decorator';
import { CreateDirectInviteDto, CreateInviteLinkDto } from './dto/invite.dto';
import { ApiBody } from '@nestjs/swagger';
import { DirectInviteResponseDto, LinkInviteResponseDto } from './dto/invite-response.dto';
import { UserInterface } from '../../shared/interfaces/users.interface';

@Controller('workspace-invite')
export class WorkspaceInviteController {
  constructor(private readonly workspaceInviteService: WorkspaceInviteService) { }

  @Post(':workspaceId/direct')
  @ResponseMessage("Create direct invite successfully!")
  @ApiBody({
    type: CreateDirectInviteDto,
    description: 'Directly invite a user to a workspace',
    examples: {
      default: {
        summary: 'Invite user with workspace and user IDs',
        value: {
          invitedUserId: 'user-uuid',
        }
      }
    }
  })
  async inviteDirectly(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDirectInviteDto,
    @GetUser() user: UserInterface,
  ) {
    return this.workspaceInviteService.createDirectInvite({
      ...dto,
      workspaceId,
    }, user.id);
  }

  @Post(':workspaceId/link')
  @ResponseMessage("Create invite link successfully!")
  @ApiBody({
    type: CreateInviteLinkDto,
    description: 'Create an invite link for a workspace',
    examples: {
      default: {
        summary: 'Create invite link with workspace ID and expiration date',
        value: {
          expiresAt: '2024-12-31T23:59:59.000Z',
        }
      }
    }
  })
  async inviteByLink(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateInviteLinkDto,
    @GetUser() user: UserInterface
  ) {
    return this.workspaceInviteService.createInviteLink({
      ...dto,
      workspaceId,
    }, user.id);
  }

  @Post('accept-direct')
  @ResponseMessage("Accept direct invite successfully!")
  @ApiBody({
    type: DirectInviteResponseDto,
    description: 'Accept a direct invite to join a workspace',
    examples: {
      default: {
        summary: 'Accept direct invite with invite ID and current user ID',
        value: {
          inviteId: 'direct-invite-uuid',
        }
      }
    }
  })
  async acceptDirectInvite(
    @Body() dto: DirectInviteResponseDto,
    @GetUser() user: UserInterface
  ) {
    return this.workspaceInviteService.acceptDirectInvite(dto, user.id);
  }

  @Post('accept-link')
  @ResponseMessage("Accept invite link successfully!")
  @ApiBody({
    type: LinkInviteResponseDto,
    description: 'Accept an invite link to join a workspace',
    examples: {
      default: {
        summary: 'Accept invite link with token and current user ID',
        value: {
          token: 'invite-token',
        }
      }
    }
  })
  async acceptLinkInvite(
    @Body() dto: LinkInviteResponseDto,
    @GetUser() user: UserInterface
  ) {
    return this.workspaceInviteService.acceptLinkInvite(dto, user.id);
  }

  @Post('deny')
  @ResponseMessage("Deny invite successfully!")
  @ApiBody({
    type: DirectInviteResponseDto,
    description: 'Deny a direct invite to join a workspace',
    examples: {
      default: {
        summary: 'Deny direct invite with invite ID and current user ID',
        value: {
          inviteId: 'direct-invite-uuid',
        }
      }
    }
  })
  async denyInvite(
    @Body() dto: DirectInviteResponseDto, 
    @GetUser() user: UserInterface
  ) {
    return this.workspaceInviteService.denyInvite(dto, user.id);
  }

  @Patch(':inviteId/revoke')
  @ResponseMessage("Revoke invite successfully!")
  async revokeInvite(
    @Param('inviteId') inviteId: string,
    @GetUser() user: UserInterface
  ) {
    return this.workspaceInviteService.revokeInvite(inviteId, user.id);
  }
}
