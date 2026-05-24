import { Module } from '@nestjs/common';
import { ConversationMembersService } from './conversation_members.service';
import { ConversationMembersController } from './conversation_members.controller';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConversationMembersController],
  providers: [ConversationMembersService],
  exports: [ConversationMembersService],
})
export class ConversationMembersModule {}
