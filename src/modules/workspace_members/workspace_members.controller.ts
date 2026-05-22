import { Controller, Get, Param, Query } from '@nestjs/common';
import { WorkspaceMembersService } from './workspace_members.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/customize.decorator';

@Controller('workspace-members')
export class WorkspaceMembersController {
  constructor(private readonly workspaceMembersService: WorkspaceMembersService) {}

  @Get('/:workspaceId')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get all workspace members successfully!')
  async getAllMembers(
    @Param('workspaceId') workspaceId: string,
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
  ) {
    return this.workspaceMembersService.getWorkspaceMembers(+currentPage, +limit, workspaceId);
  }
}
