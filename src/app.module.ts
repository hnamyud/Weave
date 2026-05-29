import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { ConversationMembersModule } from './modules/conversation_members/conversation_members.module';
import { FileModule } from './modules/files/file.module';
import { MessageModule } from './modules/messages/message.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspaceModule } from './modules/workspaces/workspace.module';
import { SearchModule } from './modules/search/search.module';
import { WorkspaceMembersModule } from './modules/workspace_members/workspace_members.module';
import { WorkspaceInviteModule } from './modules/workspace_invite/workspace_invite.module';
import { RedisModule } from './common/cache/redis.module';
import { ConfigModule } from '@nestjs/config';
import { CaslModule } from './common/casl/casl.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CaslModule,
    AuthModule,
    ConversationModule,
    ConversationMembersModule,
    FileModule,
    MessageModule,
    NotificationModule,
    RealtimeModule,
    RedisModule,
    SearchModule,
    UsersModule,
    WorkspaceMembersModule,
    WorkspaceInviteModule,
    WorkspaceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
