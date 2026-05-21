import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class CreateWorkspaceMembersDto {
    @ApiProperty()
    @IsNotEmpty({ message: 'Workspace ID cannot be empty' })
    workspaceId: string;

    @ApiProperty()
    @IsNotEmpty({ message: 'User ID cannot be empty' })
    userId: string;
}