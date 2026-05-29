import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { ConversationMembersModule } from '../conversation_members/conversation_members.module';

@Module({
  imports: [PrismaModule, ConversationMembersModule],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
