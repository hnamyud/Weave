import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
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
  content?: string;

  @ApiPropertyOptional({ type: [FileMetadataDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FileMetadataDto)
  attachments?: FileMetadataDto[];
}
