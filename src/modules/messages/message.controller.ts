import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import {
  GetUser,
  ResponseMessage,
} from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { MessageCursorQueryDto } from './dto/message-cursor-query.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageService } from './message.service';

@Controller()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('messages')
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateMessageDto })
  @ResponseMessage('Create message successfully!')
  async createMessage(
    @Body() dto: CreateMessageDto,
    @GetUser() user: UserInterface,
  ) {
    return this.messageService.createMessage(dto, user.id);
  }

  @Get('conversations/:conversationId/messages')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get conversation messages successfully!')
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @GetUser() user: UserInterface,
    @Query() query: MessageCursorQueryDto,
  ) {
    return this.messageService.getConversationMessages(
      conversationId,
      user.id,
      query,
    );
  }

  @Get('messages/:messageId')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get message successfully!')
  async getMessageById(
    @Param('messageId') messageId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.messageService.getMessageById(messageId, user.id);
  }

  @Patch('messages/:messageId')
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateMessageDto })
  @ResponseMessage('Update message successfully!')
  async updateMessage(
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
    @GetUser() user: UserInterface,
  ) {
    return this.messageService.updateMessage(messageId, dto, user.id);
  }

  @Delete('messages/:messageId')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Delete message successfully!')
  async deleteMessage(
    @Param('messageId') messageId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.messageService.deleteMessage(messageId, user.id);
  }

  @Post('messages/:messageId/replies')
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateReplyDto })
  @ResponseMessage('Create reply successfully!')
  async createReply(
    @Param('messageId') messageId: string,
    @Body() dto: CreateReplyDto,
    @GetUser() user: UserInterface,
  ) {
    return this.messageService.createReply(messageId, dto, user.id);
  }

  @Get('messages/:messageId/replies')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Get message replies successfully!')
  async getReplies(
    @Param('messageId') messageId: string,
    @GetUser() user: UserInterface,
    @Query() query: MessageCursorQueryDto,
  ) {
    return this.messageService.getReplies(messageId, user.id, query);
  }

  @Delete('attachments/:id')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Delete attachment successfully!')
  async deleteAttachment(
    @Param('id') attachmentId: string,
    @GetUser() user: UserInterface,
  ) {
    return this.messageService.deleteAttachment(attachmentId, user.id);
  }
}
