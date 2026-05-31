import { Processor, WorkerHost } from '@nestjs/bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { SendResetPasswordJobData } from 'src/shared/interfaces/send-resetpw.interface';

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<SendResetPasswordJobData>): Promise<void> {
    switch (job.name) {
      case 'send-reset-password':
        await this.handleResetPasswordEmail(job);
        break;

      default:
        throw new Error(`Unknown mail job: ${job.name}`);
    }
  }

  private async handleResetPasswordEmail(
    job: Job<SendResetPasswordJobData>,
  ): Promise<void> {
    const { email, subject, otp } = job.data;

    await this.mailerService.sendMail({
      to: email,
      from:
        this.configService.get<string>('MAIL_FROM') ||
        '"Support Team" <no-reply@domain.com>',
      subject,
      template: 'reset-password',
      context: {
        otp,
        year: new Date().getFullYear(),
      },
    });
  }
}
