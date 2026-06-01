import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MailModule } from '../mailer/mail.module';

@Module({
  imports: [PrismaModule, RealtimeModule, MailModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
