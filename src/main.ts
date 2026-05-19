import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { helmetConfig } from './config/helmet.config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PoliciesGuard } from './common/guards/policy.guard';
import { CaslAbilityFactory } from './common/casl/ability.factory';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Apply helmet middleware with custom config
  app.use(helmet(helmetConfig));

  // Config cookie (Http-only, Secure)
  app.use(cookieParser());

  // Config CORS
  app.enableCors({
    origin: configService.get<string>('FE_DOMAIN'), // FE domain
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  });

  // Use JWT global
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new PoliciesGuard(reflector, app.get(CaslAbilityFactory)),
  );

  app.useGlobalPipes(new ValidationPipe(
    {
      whitelist: true, // Tự động bỏ các field không có trong DTO
      forbidNonWhitelisted: true, // (Tùy chọn) Báo lỗi luôn nếu gửi field lạ
      transform: true
    }
  ));

  // Transform response from controller
  app.useGlobalInterceptors(new TransformInterceptor(reflector));
  
  app.enableShutdownHooks()
  const port = configService.get('PORT')
  await app.listen(port);
}
bootstrap();
