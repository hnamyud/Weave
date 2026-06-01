import { Controller } from '@nestjs/common';
import { PinnedMessagesService } from './pinned_messages.service';

@Controller('pinned-messages')
export class PinnedMessagesController {
  constructor(private readonly pinnedMessagesService: PinnedMessagesService) {}
}
