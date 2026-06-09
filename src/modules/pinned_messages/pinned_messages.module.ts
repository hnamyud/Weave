import { Module } from '@nestjs/common';
import { PinnedMessagesService } from './pinned_messages.service';
import { PinnedMessagesController } from './pinned_messages.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [PrismaModule, RealtimeModule],
  controllers: [PinnedMessagesController],
  providers: [PinnedMessagesService],
  exports: [PinnedMessagesService],
})
export class PinnedMessagesModule {}
