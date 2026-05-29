import { Module, Global } from '@nestjs/common';
import { CaslAbilityFactory } from './ability.factory';
import { PrismaModule } from 'prisma/prisma.module';
import { WorkspaceMemberGuard } from '../guards/workspace-member.guard';
import { ConversationMemberGuard } from '../guards/conversation-member.guard';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    CaslAbilityFactory,
    WorkspaceMemberGuard,
    ConversationMemberGuard,
  ],
  exports: [CaslAbilityFactory, WorkspaceMemberGuard, ConversationMemberGuard],
})
export class CaslModule {}
