import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  GetUser,
  ResponseMessage,
} from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { ReactionDto } from './dto/reaction.dto';

@Controller()
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post('messages/:messageId/reactions')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Toggle reaction successfully!')
  async toggleReaction(
    @Param('messageId') messageId: string,
    @GetUser() user: UserInterface,
    @Body() dto: ReactionDto,
  ) {
    return this.reactionsService.toggleReaction(user.id, messageId, dto);
  }

  @Get('/messages/:messageId/reactions')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get reactions successfully!')
  async getReactions(
    @Param('messageId') messageId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.reactionsService.getReactions(messageId, user.id);
  }

  @Delete('messages/:messageId/reactions/:emoji')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Remove reaction successfully!')
  async removeReaction(
    @Param('messageId') messageId: string,
    @Param() dto: ReactionDto,
    @GetUser() user: UserInterface,
  ) {
    return this.reactionsService.removeReaction(user.id, messageId, dto);
  }
}
