import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class UsernameSetupGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // đã qua JwtAuthGuard

    if (!user.username) {
      throw new ForbiddenException({
        code: 'USERNAME_REQUIRED',
        message: 'Please set your username before continuing',
      });
    }
    return true;
  }
}
