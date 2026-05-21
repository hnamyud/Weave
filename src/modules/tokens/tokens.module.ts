import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TokensScheduler } from './tokens.scheduler';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.register({}),
    ScheduleModule.forRoot(),
  ],
  controllers: [TokensController],
  providers: [TokensService, TokensScheduler],
  exports: [TokensService],
})
export class TokensModule {}
