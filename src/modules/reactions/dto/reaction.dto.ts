import { ApiProperty } from '@nestjs/swagger';

export class ReactionDto {
  @ApiProperty()
  emoji: string;
}
