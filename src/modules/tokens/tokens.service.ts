import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { createHash } from 'crypto';
import ms, { StringValue } from 'ms';


@Injectable()
export class TokensService implements OnModuleInit {
    private accessSecret: string;
    private accessExpiresIn: StringValue;
    private refreshSecret: string;
    private refreshExpiresIn: StringValue;
    private refreshExpiresInMs: number;

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    onModuleInit() {
        const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
        const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRED') as StringValue | undefined;
        const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
        const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRED') as StringValue | undefined;
        const refreshExpiresInMs = refreshExpiresIn ? ms(refreshExpiresIn) : undefined;

        if (
            !accessSecret ||
            !accessExpiresIn ||
            !refreshSecret ||
            !refreshExpiresIn ||
            typeof refreshExpiresInMs !== 'number'
        ) {
            throw new Error('JWT token config is invalid');
        }

        this.accessSecret = accessSecret;
        this.accessExpiresIn = accessExpiresIn;
        this.refreshSecret = refreshSecret;
        this.refreshExpiresIn = refreshExpiresIn;
        this.refreshExpiresInMs = refreshExpiresInMs;
    }

    async createRefreshToken(payload: any) {
        return this.jwtService.sign(payload, {
            secret: this.refreshSecret,
            expiresIn: this.refreshExpiresIn as any,
        });
    }

    createAccessToken(payload: any) {
        return this.jwtService.sign(payload, {
            secret: this.accessSecret,
            expiresIn: this.accessExpiresIn as any,
        });
    }

    async processToken(refreshToken: string) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.refreshSecret,
            }) as {
                id: string;
                email: string;
            };

            const tokenHash = this.hashToken(refreshToken);
            const storedToken = await this.findValidToken(tokenHash);

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
            const newRefreshTokenHash = this.hashToken(newRefreshToken);

            await this.rotateToken({
                oldTokenId: storedToken.id,
                userId: payload.id,
                newTokenHash: newRefreshTokenHash,
                expiresAt: this.getRefreshTokenExpiresAt(),
            });

            return {
                accessToken: this.createAccessToken(newPayload),
                refreshToken: newRefreshToken,
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

    getRefreshTokenMaxAge() {
        return this.refreshExpiresInMs;
    }

    async revokeRefreshToken(refreshToken: string) {
        return this.revokeToken(this.hashToken(refreshToken));
    }

    async revokeOtherRefreshTokensForUser(userId: string, currentTokenHash: string) {
        return this.prisma.refreshToken.updateMany({
            where: {
                userId,
                revokedAt: null,
                tokenHash: {
                    not: currentTokenHash,
                },
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }

    async cleanupInactiveRefreshTokens() {
        return this.prisma.refreshToken.deleteMany({
            where: {
                OR: [
                    {
                        expiresAt: {
                            lt: new Date(),
                        },
                    },
                    {
                        revokedAt: {
                            not: null,
                        },
                    },
                ],
            },
        });
    }

    async findValidToken(tokenHash: string) {
        return this.prisma.refreshToken.findFirst({
            where: {
                tokenHash,
                revokedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });
    }


    async rotateToken(data: {
        oldTokenId: string;
        userId: string;
        newTokenHash: string;
        expiresAt: Date;
    }) {
        return this.prisma.$transaction(async (tx) => {
            const oldToken = await tx.refreshToken.findUnique({
                where: {
                    id: data.oldTokenId,
                },
                select: {
                    deviceInfo: true,
                },
            });

            if (!oldToken) {
                throw new BadRequestException('Refresh token không hợp lệ!');
            }

            await tx.refreshToken.update({
                where: {
                    id: data.oldTokenId,
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                },
            });

            return tx.refreshToken.create({
                data: {
                    id: uuidv7(),
                    userId: data.userId,
                    tokenHash: data.newTokenHash,
                    expiresAt: data.expiresAt,
                    deviceInfo: oldToken.deviceInfo ?? Prisma.JsonNull,
                },
            });
        });
    }

    // Thu hồi token
    async revokeToken(tokenHash: string) {
        return this.prisma.refreshToken.updateMany({
            where: {
                tokenHash,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }

    async createRefreshTokenRecord(data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        deviceInfo?: any;
    }) {
        return this.prisma.refreshToken.create({
            data: {
                id: uuidv7(),
                userId: data.userId,
                tokenHash: data.tokenHash,
                expiresAt: data.expiresAt,
                deviceInfo: data.deviceInfo,
            },
        });
    }

    async queryUserIdByToken(refreshToken: string) {
        const record = await this.prisma.refreshToken.findUnique({
            where: {
                tokenHash: refreshToken
            }
        });
        return record?.userId;
    }
}
