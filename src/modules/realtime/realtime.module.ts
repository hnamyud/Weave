import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { StringValue } from 'ms';
import { PrismaModule } from 'prisma/prisma.module';
import { RedisModule } from '../../common/cache/redis.module';
import { SocketAuthGuard } from '../../common/guards/socket-auth.guard';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { PresenceService } from './presence.service';
import { PresenceLastSeenProcessor } from './presence.processor';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'presence-last-seen' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_ACCESS_EXPIRED',
          ) as StringValue,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    RealtimeGateway,
    RealtimeService,
    PresenceService,
    PresenceLastSeenProcessor,
    SocketAuthGuard,
  ],
  exports: [RealtimeService, PresenceService],
})
export class RealtimeModule {}
