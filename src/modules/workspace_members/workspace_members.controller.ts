import { Controller, Get, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { WorkspaceMembersService } from './workspace_members.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser, ResponseMessage } from '../../common/decorators/customize.decorator';
import { UserInterface } from 'src/shared/interfaces/users.interface';
import { WorkspaceMemberGuard } from '../../common/guards/workspace-member.guard';
import { RequireWorkspacePermission } from '../../common/decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';

@Controller('workspace-members')
export class WorkspaceMembersController {
  constructor(private readonly workspaceMembersService: WorkspaceMembersService) {}

  @Get('/:workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  @RequireWorkspacePermission(Action.Read)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get all workspace members successfully!')
  async getAllMembers(
    @Param('workspaceId') workspaceId: string,
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
  ) {
    return this.workspaceMembersService.getWorkspaceMembers(+currentPage, +limit, workspaceId);
  }

  @Patch('/:workspaceId/:userId/grant-role')
  @UseGuards(WorkspaceMemberGuard)
  @RequireWorkspacePermission(Action.Kick)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Grant workspace role successfully!')
  async grantRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Query('role') role: string,
  ) {
    return this.workspaceMembersService.grantWorkspaceRole(workspaceId, userId, role as any);
  }

  @Delete('/:workspaceId/:userId/kick')
  @UseGuards(WorkspaceMemberGuard)
  @RequireWorkspacePermission(Action.Kick)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Kick workspace member successfully!')
  async kickMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    return this.workspaceMembersService.kickMember(workspaceId, userId);
  }

  @Delete('/:workspaceId/leave')
  @UseGuards(WorkspaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Leave workspace successfully!')
  async leaveWorkspace(
    @Param('workspaceId') workspaceId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.workspaceMembersService.leaveWorkspace(workspaceId, user.id);
  }
}
