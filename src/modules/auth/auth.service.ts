import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { PrismaService } from 'prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { Response, Request } from 'express';
import { RegisterUserDto } from '../users/dto/create-user.dto';
import { UserInterface } from 'src/shared/interfaces/users.interface';
import { UAParser } from 'ua-parser-js';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private userService: UsersService,
        private prisma: PrismaService,
        private refreshTokenService: TokensService,
        // @Inject('REDIS_CLIENT') private redisClient: Redis
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.userService.findOneByEmail(email);
        if (!user || !user.password) return null;

        const isValid = await this.userService.isValidPassword(pass, user.password);
        if (!isValid) return null;

        const { password, ...safeUser } = user;
        return safeUser;
    }

    async processToken(refreshToken: string, response: Response) {
        const tokenResult = await this.refreshTokenService.processToken(refreshToken);

        response.cookie('refresh_token', tokenResult.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
            maxAge: this.refreshTokenService.getRefreshTokenMaxAge(),
        });

        return {
            accessToken: tokenResult.accessToken,
            user: tokenResult.user,
        };
    }

    async register(user: RegisterUserDto) {
        let newUser = await this.userService.registerUser(user);
        return {
            id: newUser.id,
            createdAt: newUser.createdAt
        };
    }

    async login(user: UserInterface, request: Request, response: Response) {
        const { id, email } = user;

        const payload = {
            sub: 'Access token',
            iss: 'Backend-core',
            id,
            email,
        };

        const refreshToken = await this.refreshTokenService.createRefreshToken(payload);
        const parser = new UAParser(request.headers['user-agent']);

        await this.refreshTokenService.createRefreshTokenRecord({
            userId: id,
            tokenHash: this.refreshTokenService.hashToken(refreshToken),
            expiresAt: this.refreshTokenService.getRefreshTokenExpiresAt(),
            deviceInfo: {
                browser: parser.getBrowser().name,
                browserVersion: parser.getBrowser().version,
                os: parser.getOS().name,
                osVersion: parser.getOS().version,
                device: parser.getDevice().type || 'desktop',
            }
        });

        response.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
            maxAge: this.refreshTokenService.getRefreshTokenMaxAge(),
        });

        return {
            accessToken: this.jwtService.sign(payload),
            user: {
                id,
                email,
            },
        };
    }

    async logout(refreshToken: string | undefined, response: Response) {
        try {
            if (refreshToken) {
                await this.refreshTokenService.revokeRefreshToken(refreshToken);
            }

            response.clearCookie('refresh_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite:
                    process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                path: '/',
            });

            return {
                message: 'Logout successful!',
                loggedOut: true,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            throw new UnauthorizedException('Logout failed!');
        }
    }

    async validateGoogleUser(
        googleUser: {
            email: string,
            name: string,
            providerId: string;
        }
    ): Promise<any> {
        const { email, name, providerId } = googleUser;

        const oauthAccount = await this.prisma.oAuthAccount.findUnique({
            where: {
                provider_providerUserId: {
                    provider: 'google',
                    providerUserId: providerId,
                },
            },

            include: {
                user: true,
            },
        });

        if (oauthAccount) {
            this.ensureActiveOAuthUser(oauthAccount.user);
            const { password, ...safeUser } = oauthAccount.user;
            return safeUser;
        }

        const existingUser = await this.userService.findOneByEmail(email);

        // Có email nhưng chưa liên kết tài khoản Google -> Liên kết rồi đăng nhập
        if (existingUser) {
            await this.prisma.oAuthAccount.create({
                data: {
                    id: uuidv7(),
                    userId: existingUser.id,
                    provider: 'google',
                    providerUserId: providerId,
                },
            });

            const { password, ...safeUser } = existingUser;
            return safeUser;
        }

        // User mới hoàn toàn
        const newGoogleUser = await this.userService.createGoogleUser({
            email,
            name,
            providerId,
        });
        const { password, ...safeUser } = newGoogleUser;

        return safeUser;
    }

    private ensureActiveOAuthUser(user: User) {
        if (user.deletedAt) {
            throw new UnauthorizedException('Google account is not available');
        }
    }

    buildBrowserRedirectUrl(accessToken: string) {
        const browserRedirectUri = this.configService.get<string>('BROWSER_REDIRECT_URI');

        if (!browserRedirectUri) {
            throw new InternalServerErrorException('Browser redirect URI is not configured');
        }

        const redirectUrl = new URL(browserRedirectUri);
        redirectUrl.searchParams.delete('token');
        redirectUrl.hash = new URLSearchParams({
            access_token: accessToken,
        }).toString();

        return redirectUrl.toString();
    }
}
