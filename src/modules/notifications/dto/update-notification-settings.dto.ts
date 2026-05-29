import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyMentions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyDirectMessages?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyAllMessages?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;
}
