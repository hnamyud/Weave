import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { compare, genSaltSync, hashSync } from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';
import { RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
      },
    });
  }

  async findOneById(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id: id,
        deletedAt: null,
      },
    });
  }

  async registerUser(user: RegisterUserDto) {
    const { username, email, password, displayName } = user;
    const hashPassword = await this.getHashPassword(password);

    try {
      return await this.prisma.user.create({
        data: {
          id: uuidv7(),
          displayName: displayName,
          username: username,
          email,
          password: hashPassword,
        },
      });
    } catch (error) {
      this.handleUniqueUserConstraintError(error, { email, username });
      throw error;
    }
  }

  async createGoogleUser(googleUser: {
    email: string;
    name: string;
    providerId: string;
  }) {
    const { email, name, providerId } = googleUser;

    try {
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
    } catch (error) {
      this.handleUniqueUserConstraintError(error, { email });
      throw error;
    }
  }

  async softDeleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
        deletedAt: null,
      },
    });
    if (!user) {
      throw new BadRequestException(`User: ${id} does not exist`);
    }
    return await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async updateUserPassword(email: string, newPassword: string) {
    const hashPassword = await this.getHashPassword(newPassword);
    return await this.prisma.user.update({
      where: {
        email: email,
      },
      data: {
        password: hashPassword,
      },
    });
  }

  async updateUserPasswordById(id: string, newPassword: string) {
    const hashPassword = await this.getHashPassword(newPassword);
    return await this.prisma.user.update({
      where: {
        id: id,
      },
      data: {
        password: hashPassword,
      },
    });
  }

  async updateUserEmail(id: string, newEmail: string) {
    try {
      return await this.prisma.user.update({
        where: {
          id: id,
          deletedAt: null,
        },
        data: {
          email: newEmail,
        },
      });
    } catch (error) {
      this.handleUniqueUserConstraintError(error, { email: newEmail });
      throw error;
    }
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        avatarUrl: true,
        statusText: true,
        statusEmoji: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new BadRequestException(`User: ${userId} does not exist`);
    }
    return user;
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        displayName: true,
        username: true,
        email: true,
        avatarUrl: true,
        statusText: true,
        statusEmoji: true,
        lastSeenAt: true,
      },
    });
    if (!user) {
      throw new BadRequestException(`User: ${userId} does not exist`);
    }
    return user;
  }

  async updateMyProfile(dto: UpdateUserDto, userId: string) {
    try {
      return await this.prisma.user.update({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: {
          username: dto.username,
          displayName: dto.displayName,
          avatarUrl: dto.avatarUrl,
          statusText: dto.statusText,
          statusEmoji: dto.statusEmoji,
        },
      });
    } catch (error) {
      this.handleUniqueUserConstraintError(error, {
        username: dto.username,
      });

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException(`User: ${userId} does not exist`);
      }

      throw error;
    }
  }

  // Handle Prisma unique constraint error for email and username fields
  private handleUniqueUserConstraintError(
    error: unknown,
    value: {
      email?: string;
      username?: string;
    },
  ) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target)
        ? target
        : typeof target === 'string'
          ? [target]
          : [];
      const targetText = fields.join(',');

      if (targetText.includes('email')) {
        throw new BadRequestException(
          `Email: ${value.email} is already existed`,
        );
      }

      if (targetText.includes('username')) {
        throw new BadRequestException(
          `Username: ${value.username} is already existed`,
        );
      }

      throw new BadRequestException('User already exists');
    }
  }
}
