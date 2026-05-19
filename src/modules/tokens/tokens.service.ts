import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';


@Injectable()
export class TokensService {
    constructor(
        private prisma: PrismaService,
    ) { }

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

    async createRefreshToken(data: {
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
