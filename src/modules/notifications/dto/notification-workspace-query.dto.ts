import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class NotificationWorkspaceQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}
