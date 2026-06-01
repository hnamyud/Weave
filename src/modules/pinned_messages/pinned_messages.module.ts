import { Module } from '@nestjs/common';
import { PinnedMessagesService } from './pinned_messages.service';
import { PinnedMessagesController } from './pinned_messages.controller';

@Module({
  controllers: [PinnedMessagesController],
  providers: [PinnedMessagesService],
})
export class PinnedMessagesModule {}
