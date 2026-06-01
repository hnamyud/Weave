import { Module } from '@nestjs/common';
import { ConversationMembersService } from './conversation_members.service';
import { ConversationMembersController } from './conversation_members.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { ConversationMentionSearchController } from './conversation_mention_search.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    ConversationMembersController,
    ConversationMentionSearchController,
  ],
  providers: [ConversationMembersService],
  exports: [ConversationMembersService],
})
export class ConversationMembersModule {}
