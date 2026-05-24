import { Body, Controller, Post } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { GetUser, ResponseMessage } from '../../common/decorators/customize.decorator';
import { UserInterface } from '../../shared/interfaces/users.interface';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateConversationDto })
  @ResponseMessage('Create conversation successfully!')
  async createConversation(
    @Body() dto: CreateConversationDto,
    @GetUser() user: UserInterface,
  ) {
    return this.conversationService.createConversation(dto, user.id);
  }

}
