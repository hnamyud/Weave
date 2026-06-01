import { Module } from '@nestjs/common';
import { WorkspaceInviteService } from './workspace_invite.service';
import { WorkspaceInviteController } from './workspace_invite.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { MailModule } from '../mailer/mail.module';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [WorkspaceInviteController],
  providers: [WorkspaceInviteService],
  exports: [WorkspaceInviteService],
})
export class WorkspaceInviteModule {}
