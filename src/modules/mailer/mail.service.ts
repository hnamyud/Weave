import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { SendResetPasswordDto } from '../auth/dto/reset-password.dto';
import { randomInt } from 'crypto';

@Injectable()
export class MailService {
  constructor(
    private readonly userService: UsersService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
  ) {}

  generateRandomOtp(length = 6): string {
    return randomInt(0, Math.pow(10, length)).toString().padStart(length, '0');
  }

  async sendResetPasswordEmail(sendResetPasswordDto: SendResetPasswordDto) {
    const email = this.normalizeEmail(sendResetPasswordDto.email);
    const rateLimitKey = `reset_rate_limit:${email}`;
    const attempts = await this.redisClient.get(rateLimitKey);

    if (attempts && parseInt(attempts, 10) >= 5) {
      throw new BadRequestException(
        'Too many reset attempts. Please try again later.',
      );
    }

    await this.redisClient
      .multi()
      .incr(rateLimitKey)
      .expire(rateLimitKey, 900)
      .exec();

    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      return { sent: true };
    }

    const subject = '[Weave] Password reset request';
    const otp = this.generateRandomOtp();
    await this.redisClient.set(`reset_otp:${email}`, otp, 'EX', 300);

    await this.mailQueue.add(
      'send-reset-password',
      {
        email,
        otp,
        subject,
      },
      {
        attempts: 3,
        backoff: 5000,
        removeOnComplete: true,
      },
    );

    return { sent: true };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
}
