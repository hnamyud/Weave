import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ListConversationsQueryDto {
  @ApiProperty({
    description: 'Filter conversations belonging to this workspace',
  })
  @IsUUID()
  @IsNotEmpty()
  workspaceId: string;

  @ApiPropertyOptional({
    enum: ConversationType,
    description: 'Filter by conversation type (CHANNEL, DM, GROUP_DM)',
  })
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;

  @ApiPropertyOptional({
    description: 'Filter by archived status. Omit to return all.',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by private status. Omit to return all.',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPrivate?: boolean;
}
