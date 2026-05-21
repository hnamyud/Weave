import { Module } from '@nestjs/common';
import { WorkspaceMembersService } from './workspace_members.service';
import { WorkspaceMembersController } from './workspace_members.controller';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceMembersController],
  providers: [WorkspaceMembersService],
  exports: [WorkspaceMembersService]
})
export class WorkspaceMembersModule {}
