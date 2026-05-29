import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class FileMetadataDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, {
    message: 'fileHash must be a lowercase SHA-256 hex string',
  })
  fileHash: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileType: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(15 * 1024 * 1024)
  fileSize: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  storageKey?: string;
}
