import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty()
  @MinLength(3)
  @MaxLength(50)
  @IsNotEmpty({ message: 'Workspace name cannot be empty' })
  name: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Slug cannot be empty' })
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được gồm chữ thường, số và dấu gạch ngang',
  })
  slug: string;

  @ApiProperty()
  @IsOptional()
  iconUrl?: string;
}
