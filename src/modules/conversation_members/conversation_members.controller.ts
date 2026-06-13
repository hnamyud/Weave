import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ConversationMembersService } from './conversation_members.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  GetUser,
  ResponseMessage,
} from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { ConversationMemberGuard } from '../../common/guards/conversation-member.guard';
import { PoliciesGuard } from '../../common/guards/policy.guard';
import { RequireConversationPermission } from '../../common/decorators/policy.decorator';
import { Action } from '../../shared/enums/action.enum';

@Controller('conversation-members')
export class ConversationMembersController {
  constructor(
    private readonly conversationMembersService: ConversationMembersService,
  ) {}

  @Get('/:conversationId')
  @UseGuards(ConversationMemberGuard, PoliciesGuard)
  @RequireConversationPermission(Action.Read)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get conversation members successfully!')
  async getAllMembers(
    @Param('conversationId') conversationId: string,
    @Query('current') currentPage: string | undefined,
    @Query('pageSize') limit: string | undefined,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationMembersService.getConversationMembers(
      currentPage,
      limit,
      conversationId,
      user.id,
    );
  }
}
