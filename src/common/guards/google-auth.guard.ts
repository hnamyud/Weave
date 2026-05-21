import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';

const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    if (request.path.endsWith('/google/login')) {
      request.googleOAuthState = randomBytes(32).toString('hex');
      response.cookie(GOOGLE_OAUTH_STATE_COOKIE, request.googleOAuthState, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/auth/google',
        maxAge: 5 * 60 * 1000,
      });
    }

    if (request.path.endsWith('/google/callback')) {
      const queryState = request.query?.state;
      const cookieState = request.cookies?.[GOOGLE_OAUTH_STATE_COOKIE];

      response.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/auth/google',
      });

      if (
        typeof queryState !== 'string' ||
        typeof cookieState !== 'string' ||
        queryState !== cookieState
      ) {
        throw new UnauthorizedException('Invalid Google OAuth state');
      }
    }

    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    return {
      session: false,
      state: request.googleOAuthState,
    };
  }
}
