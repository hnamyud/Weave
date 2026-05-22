import { Body, Controller, Param, Post, Patch, Get, Query } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { GetUser, ResponseMessage } from '../../common/decorators/customize.decorator';
import { ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { UserInterface } from '../../shared/interfaces/users.interface';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) { }

  @Post()
  @ApiBearerAuth('access-token')
  @ResponseMessage('Workspace created successfully!')
  @ApiBody({
    type: CreateWorkspaceDto,
    description: 'Information required to create a new workspace',
    examples: {
      default: {
        summary: 'Create a workspace with name, slug, icon URL, and owner ID',
        value: {
          name: 'My Workspace',
          slug: 'my-workspace',
          iconUrl: 'https://example.com/icon.png',
        }
      }
    }
  })
  async createWorkspace(
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @GetUser() user: UserInterface
  ) {
    return this.workspaceService.createWorkspace(createWorkspaceDto, user.id);
  }

  @Get('/')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get all user\'s workspaces successfully!')
  async getAllWorkspaces(
    @GetUser() user: UserInterface,
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
  ) {
    return this.workspaceService.getAllWorkspaceById( +currentPage, +limit, user.id);
  }
}
