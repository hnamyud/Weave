import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class NotificationSettingsQueryDto {
  @ApiProperty()
  @IsUUID()
  workspaceId: string;
}
