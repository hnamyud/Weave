import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FileMetadataDto } from '../../files/dto/file-metadata.dto';

export class CreateMessageDto {
  @ApiProperty()
  @IsUUID()
  conversationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ApiPropertyOptional({ type: [FileMetadataDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => FileMetadataDto)
  attachments?: FileMetadataDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  mentionedUserIds?: string[];
}
