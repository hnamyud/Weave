import { Controller, Get, Param, Query } from '@nestjs/common';
import { ConversationMembersService } from './conversation_members.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser, ResponseMessage } from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';

@Controller('conversation-members')
export class ConversationMembersController {
  constructor(private readonly conversationMembersService: ConversationMembersService) {}

  @Get('/:conversationId')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get conversation members successfully!')
  async getAllMembers(
    @Param('conversationId') conversationId: string,
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationMembersService.getConversationMembers(
      +currentPage,
      +limit,
      conversationId,
      user.id,
    );
  }
}
