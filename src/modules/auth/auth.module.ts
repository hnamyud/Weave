import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './passport/jwt.strategy';
import { GoogleStrategy } from './passport/google.strategy';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import googleOauthConfig from 'src/config/google-oauth.config';
import { UsersModule } from '../users/users.module';
import { TokensModule } from '../tokens/tokens.module';
import { RedisModule } from 'src/common/cache/redis.module';
import { PasswordService } from './password.service';

@Module({
  imports: [
    TokensModule,
    UsersModule,
    PrismaModule,
    RedisModule,
    PassportModule,
    ConfigModule.forFeature(googleOauthConfig),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_ACCESS_EXPIRED') as any },
      }),
      inject: [ConfigService]
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    JwtStrategy,
    GoogleStrategy
  ],
})
export class AuthModule {}
