import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class NotificationCursorQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isRead?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}
