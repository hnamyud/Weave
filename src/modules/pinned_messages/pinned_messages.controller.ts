import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  GetUser,
  ResponseMessage,
} from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { MessageCursorQueryDto } from '../messages/dto/message-cursor-query.dto';
import { PinnedMessagesService } from './pinned_messages.service';

@Controller()
export class PinnedMessagesController {
  constructor(private readonly pinnedMessagesService: PinnedMessagesService) {}

  @Post('messages/:messageId/pin')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Pin message successfully!')
  async pinMessage(
    @Param('messageId') messageId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.pinnedMessagesService.pinMessage(messageId, user.id);
  }

  @Delete('messages/:messageId/pin')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Unpin message successfully!')
  async unpinMessage(
    @Param('messageId') messageId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.pinnedMessagesService.unpinMessage(messageId, user.id);
  }

  @Get('conversations/:conversationId/pinned-messages')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get pinned messages successfully!')
  async getPinnedMessages(
    @Param('conversationId') conversationId: string,
    @GetUser() user: UserInterface,
    @Query() query: MessageCursorQueryDto,
  ) {
    return this.pinnedMessagesService.getPinnedMessages(
      conversationId,
      user.id,
      query,
    );
  }
}
