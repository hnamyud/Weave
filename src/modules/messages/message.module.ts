import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { FileModule } from '../files/file.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [PrismaModule, FileModule, RealtimeModule, NotificationModule],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
