import { Module, Search } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { FileModule } from './modules/files/file.module';
import { MessageModule } from './modules/messages/message.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspaceModule } from './modules/workspaces/workspace.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    AuthModule,
    ConversationModule,
    FileModule,
    MessageModule,
    NotificationModule,
    RealtimeModule,
    SearchModule,
    UsersModule,
    WorkspaceModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
