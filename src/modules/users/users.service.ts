import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { compare, genSaltSync, hashSync } from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';
import { RegisterUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
    ) { }

    async getHashPassword(password: string) {
        const salt = genSaltSync(10);
        const hash = hashSync(password, salt);
        return hash;
    }

    async isValidPassword(password: string, hash: string) {
        return compare(password, hash);
    }

    async findOneByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: {
                email: email,
                deletedAt: null,
            }
        });
    }

    async registerUser(user: RegisterUserDto) {
        const { username, email, password, displayName } = user;
        const isExisted = await this.findOneByEmail(email);
        if (isExisted) {
            throw new BadRequestException(`Email: ${email} is already existed`);
        }
        const hashPassword = await this.getHashPassword(password);
        return await this.prisma.user.create({
            data: {
                id: uuidv7(),
                displayName: displayName,
                username: username,
                email,
                password: hashPassword,
            }
        });
    }

    async createGoogleUser(googleUser: {
        email: string;
        name: string;
        providerId: string;
    }) {
        const { email, name, providerId } = googleUser;
        const isExisted = await this.findOneByEmail(email);
        if (isExisted) {
            throw new BadRequestException(`Email: ${email} is already existed`);
        }

        return await this.prisma.user.create({
            data: {
                id: uuidv7(),
                displayName: name,
                email,

                // OAuth account -> không có password local
                password: null,

                oauthAccounts: {
                    create: {
                        id: uuidv7(),
                        provider: 'google',
                        providerUserId: providerId,
                    },
                },
            },

            include: {
                oauthAccounts: true,
            },
        });
    }

    async softDeleteUser(id: string) {
        const user = await this.prisma.user.findUnique({
            where: {
                id: id
            }
        });
        if (!user) {
            throw new BadRequestException(`User: ${id} does not exist`);
        }
        return await this.prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                deletedAt: new Date()
            }
        });
    }

    async changePassword(
        id: string,
        oldPassword: string,
        newPassword: string
    ) {
        const user = await this.prisma.user.findUnique({
            where: {
                id: id
            }
        });
        if (!user) {
            throw new BadRequestException(`User: ${id} does not exist`);
        }
        if (!user.password) {
            throw new BadRequestException(
                'Your account is registered via Google OAuth, you can set up a password in your profile settings to enable local login and password change features.',
            );
        }
        // Kiểm tra mật khẩu cũ
        const isMatch = await compare(oldPassword, user.password);
        if (!isMatch) {
            throw new BadRequestException('Old password is incorrect');
        }
        // Kiểm tra mật khẩu mới có khác mật khẩu cũ không
        const isSamePassword = await compare(newPassword, user.password);
        if (isSamePassword) {
            throw new BadRequestException('New password cannot be the same as the old password');
        }
        const hashPassword = await this.getHashPassword(newPassword);
        await this.prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                password: hashPassword
            }
        });
        return {
            id: user.id,
            email: user.email,
        };
    }

    async updateUserPassword(email: string, newPassword: string) {
        const hashPassword = await this.getHashPassword(newPassword);
        return await this.prisma.user.update({
            where: {
                email: email
            },
            data: {
                password: hashPassword
            }
        });
    }
}
