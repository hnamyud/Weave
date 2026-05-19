import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from 'prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import ms, { StringValue } from 'ms';
import { Response, Request } from 'express';
import { RegisterUserDto } from '../users/dto/create-user.dto';
import { UserInterface } from 'src/shared/interfaces/users.interface';
import { createHash } from 'crypto';
import { UAParser } from 'ua-parser-js';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class AuthService implements OnModuleInit {
    private refreshSecret: string;
    private refreshExpiresIn: StringValue;
    private refreshExpiresInMs: number;

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private userService: UsersService,
        private prisma: PrismaService,
        private refreshTokenService: TokensService,
        // @Inject('REDIS_CLIENT') private redisClient: Redis
    ) { }

    onModuleInit() {
        const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
        const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRED') as StringValue | undefined;
        const refreshExpiresInMs = refreshExpiresIn ? ms(refreshExpiresIn) : undefined;

        if (!refreshSecret || !refreshExpiresIn || typeof refreshExpiresInMs !== 'number') {
            throw new Error('JWT refresh token config is invalid');
        }

        this.refreshSecret = refreshSecret;
        this.refreshExpiresIn = refreshExpiresIn;
        this.refreshExpiresInMs = refreshExpiresInMs;
    }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.userService.findOneByEmail(email);
        if (!user || !user.password) return null;

        const isValid = await this.userService.isValidPassword(pass, user.password);
        if (!isValid) return null;

        const { password, ...safeUser } = user;
        return safeUser;
    }

    async createRefreshToken(payload: any) {
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.refreshSecret,
            expiresIn: this.refreshExpiresIn as any,
        });
        return refreshToken;
    }

    async processToken(refreshToken: string, response: Response) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.refreshSecret,
            }) as {
                id: string;
                email: string;
            };

            const tokenHash = await this.hashToken(refreshToken);

            const storedToken = await this.refreshTokenService.findValidToken(tokenHash);

            if (!storedToken || storedToken.userId !== payload.id) {
                throw new BadRequestException('Refresh token không hợp lệ!');
            }

            const newPayload = {
                sub: 'Access token',
                iss: 'Backend-core',
                id: payload.id,
                email: payload.email,
            };

            const newRefreshToken = await this.createRefreshToken(newPayload);
            const newRefreshTokenHash = await this.hashToken(newRefreshToken);

            await this.refreshTokenService.rotateToken({
                oldTokenId: storedToken.id,
                userId: payload.id,
                newTokenHash: newRefreshTokenHash,
                expiresAt: this.getRefreshTokenExpiresAt(),
            });

            response.cookie('refresh_token', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                path: '/',
                maxAge: this.refreshExpiresInMs,
            });

            return {
                accessToken: this.jwtService.sign(newPayload),
                user: {
                    id: payload.id,
                    email: payload.email,
                },
            };
        } catch {
            throw new BadRequestException('Refresh token không hợp lệ!');
        }
    }

    hashToken(token: string) {
        return createHash('sha256').update(token).digest('hex');
    }

    getRefreshTokenExpiresAt() {
        return new Date(Date.now() + this.refreshExpiresInMs);
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

        const refreshToken = await this.createRefreshToken(payload);
        const parser = new UAParser(request.headers['user-agent']);

        await this.refreshTokenService.createRefreshToken({
            userId: id,
            tokenHash: this.hashToken(refreshToken),
            expiresAt: this.getRefreshTokenExpiresAt(),
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
            maxAge: this.refreshExpiresInMs,
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
                const tokenHash = this.hashToken(refreshToken);

                await this.refreshTokenService.revokeToken(tokenHash);
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
            return oauthAccount.user;
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

            return existingUser;
        }

        // User mới hoàn toàn
        return await this.userService.createGoogleUser({
            email,
            name,
            providerId,
        });
    }
}
