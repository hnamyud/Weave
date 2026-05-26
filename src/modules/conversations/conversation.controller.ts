import { Body, Controller, Param, Post, Get, Patch, Delete, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { GetUser, ResponseMessage } from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationMemberGuard } from '../../common/guards/conversation-member.guard';
import { WorkspaceMemberGuard } from '../../common/guards/workspace-member.guard';
import { RequireConversationPermission, RequireWorkspacePermission } from '../../common/decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @UseGuards(WorkspaceMemberGuard)
  @RequireWorkspacePermission(Action.Create)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateConversationDto })
  @ResponseMessage('Create conversation successfully!')
  async createConversation(
    @Body() dto: CreateConversationDto,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.createConversation(dto, user.id);
  }

  @Post('/:conversationId/join')
  @UseGuards(WorkspaceMemberGuard)
  @RequireConversationPermission(Action.Join)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Join conversation successfully!')
  async joinConversation(
    @Param('conversationId') conversationId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.joinChannel(conversationId, user.id);
  }

  @Post('/:id/leave')
  @UseGuards(ConversationMemberGuard)
  @RequireConversationPermission(Action.Leave)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Leave conversation successfully!')
  async leaveConversation(
    @Param('id') conversationId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.leaveChannel(conversationId, user.id);
  }

  @Get('/:id')
  @UseGuards(ConversationMemberGuard)
  @RequireConversationPermission(Action.Read)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get conversation successfully!')
  async getConversationById(
    @Param('id') conversationId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.getConversationById(conversationId, user.id);
  }

  @Patch('/:id')
  @UseGuards(ConversationMemberGuard)
  @RequireConversationPermission(Action.Update)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateConversationDto })
  @ResponseMessage('Update conversation successfully!')
  async updateConversation(
    @Param('id') conversationId: string,
    @Body() dto: UpdateConversationDto,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.updateConversation(conversationId, dto, user.id);
  }

  @Patch('/:id/archive')
  @UseGuards(ConversationMemberGuard)
  @RequireConversationPermission(Action.Archive)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Archive conversation successfully!')
  async archiveConversation(
    @Param('id') conversationId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.archiveConversation(conversationId, user.id);
  }

  @Patch('/:id/unarchive')
  @UseGuards(ConversationMemberGuard)
  @RequireConversationPermission(Action.Archive)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Unarchive conversation successfully!')
  async unarchiveConversation(
    @Param('id') conversationId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.unarchiveConversation(conversationId, user.id);
  }

  @Delete('/:id')
  @UseGuards(ConversationMemberGuard)
  @RequireConversationPermission(Action.Delete)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Delete conversation successfully!')
  async deleteConversation(
    @Param('id') conversationId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.softDeleteConversation(conversationId, user.id);
  }
}
