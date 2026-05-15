import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { RealtimeController } from './realtime.controller';

@Module({
  controllers: [RealtimeController],
  providers: [RealtimeService],
})
export class RealtimeModule {}
