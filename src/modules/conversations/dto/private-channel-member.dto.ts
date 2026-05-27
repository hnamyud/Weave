import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class PrivateChannelMemberDto {
  @IsUUID()
  @ApiProperty()
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;
}
