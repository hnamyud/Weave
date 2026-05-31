import { Processor, WorkerHost } from '@nestjs/bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import {
  MailJobData,
  SendMentionNotificationJobData,
  SendResetPasswordJobData,
  SendWorkspaceInviteJobData,
} from 'src/shared/interfaces/send-resetpw.interface';

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<void> {
    switch (job.name) {
      case 'send-reset-password':
        await this.handleResetPasswordEmail(
          job as Job<SendResetPasswordJobData>,
        );
        break;

      case 'send-workspace-invite':
        await this.handleWorkspaceInviteEmail(
          job as Job<SendWorkspaceInviteJobData>,
        );
        break;

      case 'send-mention-notification':
        await this.handleMentionNotificationEmail(
          job as Job<SendMentionNotificationJobData>,
        );
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
      from: this.getMailFrom(),
      subject,
      template: 'reset-password',
      context: {
        otp,
        year: new Date().getFullYear(),
      },
    });
  }

  private async handleWorkspaceInviteEmail(
    job: Job<SendWorkspaceInviteJobData>,
  ): Promise<void> {
    const { email, subject, inviteUrl, workspaceName, inviterName } = job.data;

    await this.mailerService.sendMail({
      to: email,
      from: this.getMailFrom(),
      subject,
      template: 'workspace-invite',
      context: {
        inviteUrl,
        workspaceName,
        inviterName,
        year: new Date().getFullYear(),
      },
    });
  }

  private async handleMentionNotificationEmail(
    job: Job<SendMentionNotificationJobData>,
  ): Promise<void> {
    const {
      email,
      subject,
      actorName,
      workspaceName,
      conversationName,
      messagePreview,
      messageUrl,
    } = job.data;

    await this.mailerService.sendMail({
      to: email,
      from: this.getMailFrom(),
      subject,
      template: 'mention-notification',
      context: {
        actorName,
        workspaceName,
        conversationName,
        messagePreview,
        messageUrl,
        year: new Date().getFullYear(),
      },
    });
  }

  private getMailFrom() {
    return (
      this.configService.get<string>('MAIL_FROM') ||
      '"Support Team" <no-reply@domain.com>'
    );
  }
}
