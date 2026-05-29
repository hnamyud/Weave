import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { FileModule } from '../files/file.module';

@Module({
  imports: [PrismaModule, FileModule],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
