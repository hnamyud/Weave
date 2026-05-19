import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from "@nestjs/config";
import { AuthService } from "../auth.service";
import googleOauthConfig from "src/config/google-oauth.config";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    private readonly logger = new Logger(GoogleStrategy.name);
    constructor(
        @Inject(googleOauthConfig.KEY) private googleConfiguration:
            ConfigType<typeof googleOauthConfig>,
        private authService: AuthService,
    ) {
        const { clientID, clientSecret, redirectURI } = googleConfiguration;
        if (!clientID || !clientSecret || !redirectURI) {
            throw new Error('Google OAuth config is missing required fields');
        }
        super({
            clientID,
            clientSecret,
            callbackURL: redirectURI,
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback
    ) {
        const user = await this.authService.validateGoogleUser({
            email: profile.emails[0].value,
            name: profile.displayName,
            providerId: profile.id,
        });
        done(null, user);
    }
}
