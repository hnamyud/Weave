import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  GetUser,
  ResponseMessage,
} from '../../common/decorators/customize.decorator';
import { RequireConversationPermission } from '../../common/decorators/policy.decorator';
import { ConversationMemberGuard } from '../../common/guards/conversation-member.guard';
import { PoliciesGuard } from '../../common/guards/policy.guard';
import { Action } from '../../shared/enums/action.enum';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { ConversationMembersService } from './conversation_members.service';

@Controller('conversations/:conversationId/members')
export class ConversationMentionSearchController {
  constructor(
    private readonly conversationMembersService: ConversationMembersService,
  ) {}

  @Get('mention-search')
  @UseGuards(ConversationMemberGuard, PoliciesGuard)
  @RequireConversationPermission(Action.Read)
  @ApiBearerAuth('access-token')
  @ResponseMessage('Search mention candidates successfully!')
  async searchMentionCandidates(
    @Param('conversationId') conversationId: string,
    @Query('q') query: string | undefined,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationMembersService.searchMentionCandidates(
      conversationId,
      user.id,
      query,
    );
  }
}
